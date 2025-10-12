import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { supabase } from '../../lib/supabase';
import {
  Briefcase,
  Mail,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { NetTermsApplication, NetTermsStatus } from '../../contexts/AuthContext';

interface UserRecord {
  id: string;
  email: string;
  customer_id: string | null;
  net_terms_status: NetTermsStatus | null;
  net_terms_requested_at: string | null;
  net_terms_reviewed_at: string | null;
  net_terms_application: NetTermsApplication | null;
}

interface CustomerRecord {
  id: string;
  company: string;
  email: string;
  phone: string | null;
  terms_allowed: boolean;
}

interface NetTermsApplicant {
  userId: string;
  email: string;
  status: NetTermsStatus;
  requestedAt: string | null;
  reviewedAt: string | null;
  customerId: string | null;
  customer: CustomerRecord | null;
  application: NetTermsApplication | null;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (err) {
    return value;
  }
}

function statusBadgeClasses(status: NetTermsStatus) {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'pending':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'declined':
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export default function AdminNetTerms() {
  const [applicants, setApplicants] = useState<NetTermsApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decisionLoading, setDecisionLoading] = useState<string | null>(null);

  const pendingCount = useMemo(() => applicants.filter((record) => record.status === 'pending').length, [applicants]);
  const approvedCount = useMemo(() => applicants.filter((record) => record.status === 'approved').length, [applicants]);
  const declinedCount = useMemo(() => applicants.filter((record) => record.status === 'declined').length, [applicants]);

  useEffect(() => {
    loadApplicants();
  }, []);

  async function loadApplicants() {
    try {
      setLoading(true);
      setError('');

      const { data, error: usersError } = await supabase
        .from('users')
        .select('id, email, customer_id, net_terms_status, net_terms_requested_at, net_terms_reviewed_at, net_terms_application')
        .eq('account_type', 'business')
        .order('net_terms_requested_at', { ascending: false });

      if (usersError) {
        throw usersError;
      }

      const userRecords = (data || []) as UserRecord[];
      const customerIds = userRecords
        .map((record) => record.customer_id)
        .filter((id): id is string => Boolean(id));

      let customerMap = new Map<string, CustomerRecord>();

      if (customerIds.length > 0) {
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('id, company, email, phone, terms_allowed')
          .in('id', customerIds);

        if (customerError) {
          throw customerError;
        }

        customerMap = new Map((customerData || []).map((record) => [record.id, record as CustomerRecord]));
      }

      const filteredRecords = userRecords.filter((record) => {
        const status = record.net_terms_status || 'not_requested';
        const customer = record.customer_id ? customerMap.get(record.customer_id) : null;
        return status !== 'not_requested' || customer?.terms_allowed;
      });

      const merged = filteredRecords.map<NetTermsApplicant>((record) => {
        const status: NetTermsStatus = record.net_terms_status || 'not_requested';
        return {
          userId: record.id,
          email: record.email,
          status,
          requestedAt: record.net_terms_requested_at,
          reviewedAt: record.net_terms_reviewed_at,
          customerId: record.customer_id,
          customer: record.customer_id ? customerMap.get(record.customer_id) || null : null,
          application: record.net_terms_application,
        };
      });

      setApplicants(merged);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load NET terms applications.';
      setError(message);
    } finally {
      setLoading(false);
      setDecisionLoading(null);
    }
  }

  async function handleDecision(applicant: NetTermsApplicant, decision: 'approve' | 'decline') {
    if (!applicant.userId) {
      return;
    }

    if (!applicant.customerId) {
      setError('This account does not have an associated customer record. Please ensure the account profile is complete before updating NET terms.');
      return;
    }

    try {
      setDecisionLoading(applicant.userId + decision);
      setError('');

      if (decision === 'approve') {
        await supabase
          .from('customers')
          .update({ terms_allowed: true })
          .eq('id', applicant.customerId);

        await supabase
          .from('users')
          .update({ net_terms_status: 'approved', net_terms_reviewed_at: new Date().toISOString() })
          .eq('id', applicant.userId);
      } else {
        await supabase
          .from('customers')
          .update({ terms_allowed: false })
          .eq('id', applicant.customerId);

        await supabase
          .from('users')
          .update({ net_terms_status: 'declined', net_terms_reviewed_at: new Date().toISOString() })
          .eq('id', applicant.userId);
      }

      await loadApplicants();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update NET terms status. Please try again.';
      setError(message);
      setDecisionLoading(null);
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">NET Terms Applications</h1>
            <p className="text-gray-600">Review and manage business credit applications submitted by customers.</p>
          </div>
          <button
            onClick={loadApplicants}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
            <p className="text-xs uppercase text-blue-800">Pending</p>
            <p className="mt-2 text-3xl font-bold text-blue-900">{pendingCount}</p>
            <p className="text-xs text-blue-700">Awaiting review</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-5">
            <p className="text-xs uppercase text-green-800">Approved</p>
            <p className="mt-2 text-3xl font-bold text-green-900">{approvedCount}</p>
            <p className="text-xs text-green-700">Active NET accounts</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
            <p className="text-xs uppercase text-gray-700">Declined</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{declinedCount}</p>
            <p className="text-xs text-gray-600">Applications declined</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          </div>
        ) : applicants.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-600">
            <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            No business accounts have requested NET terms yet.
          </div>
        ) : (
          <div className="space-y-6">
            {applicants.map((applicant) => {
              const status = applicant.status;
              const statusClass = statusBadgeClasses(status);
              const isPending = status === 'pending';
              const customerName = applicant.customer?.company || '—';
              const application = applicant.application;

              return (
                <div key={applicant.userId} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <Briefcase className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-semibold text-gray-900">{customerName}</h2>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {applicant.email}
                        </span>
                        {applicant.customer?.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {applicant.customer.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>
                        {status === 'approved' ? <CheckCircle className="w-4 h-4" /> : status === 'declined' ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                      <div className="mt-3 text-xs text-gray-500 space-y-1">
                        <p>
                          Requested: <span className="font-medium text-gray-700">{formatDate(applicant.requestedAt)}</span>
                        </p>
                        <p>
                          Reviewed: <span className="font-medium text-gray-700">{formatDate(applicant.reviewedAt)}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="space-y-2 text-sm text-gray-600">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Application Details</h3>
                      {application ? (
                        <dl className="grid grid-cols-1 gap-y-1">
                          {application.accountsPayableEmail && (
                            <div className="flex justify-between gap-4">
                              <dt className="text-gray-500">Accounts Payable Email</dt>
                              <dd className="font-medium text-gray-800">{application.accountsPayableEmail}</dd>
                            </div>
                          )}
                          {application.estimatedMonthlySpend && (
                            <div className="flex justify-between gap-4">
                              <dt className="text-gray-500">Estimated Spend</dt>
                              <dd className="font-medium text-gray-800">{application.estimatedMonthlySpend}</dd>
                            </div>
                          )}
                          {application.taxId && (
                            <div className="flex justify-between gap-4">
                              <dt className="text-gray-500">Tax ID</dt>
                              <dd className="font-medium text-gray-800">{application.taxId}</dd>
                            </div>
                          )}
                          {application.contactPhone && (
                            <div className="flex justify-between gap-4">
                              <dt className="text-gray-500">Primary Phone</dt>
                              <dd className="font-medium text-gray-800">{application.contactPhone}</dd>
                            </div>
                          )}
                          {application.notes && (
                            <div>
                              <dt className="text-gray-500">Notes</dt>
                              <dd className="font-medium text-gray-800 whitespace-pre-wrap">{application.notes}</dd>
                            </div>
                          )}
                        </dl>
                      ) : (
                        <p>No application details were provided.</p>
                      )}
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Account Snapshot</h3>
                      <dl className="grid grid-cols-1 gap-y-1">
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">Customer Record</dt>
                          <dd className="font-medium text-gray-800">{applicant.customerId || '—'}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">Terms Allowed</dt>
                          <dd className="font-medium text-gray-800">{applicant.customer?.terms_allowed ? 'Yes' : 'No'}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                    {isPending && (
                      <>
                        <button
                          onClick={() => handleDecision(applicant, 'decline')}
                          disabled={decisionLoading === applicant.userId + 'decline'}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {decisionLoading === applicant.userId + 'decline' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          Decline
                        </button>
                        <button
                          onClick={() => handleDecision(applicant, 'approve')}
                          disabled={decisionLoading === applicant.userId + 'approve'}
                          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {decisionLoading === applicant.userId + 'approve' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Approve NET Terms
                        </button>
                      </>
                    )}
                    {!isPending && (
                      <button
                        onClick={() => handleDecision(applicant, status === 'approved' ? 'decline' : 'approve')}
                        disabled={decisionLoading === applicant.userId + (status === 'approved' ? 'decline' : 'approve')}
                        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {status === 'approved' ? 'Revoke Terms' : 'Reconsider'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
