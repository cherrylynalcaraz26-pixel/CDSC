'use client'

import { useSearchParams } from 'next/navigation'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

export default function ConfirmPage() {
  const params = useSearchParams()
  const status = params?.get('status') ?? 'error'
  const type = params?.get('type') ?? 'so'
  const ref = params?.get('ref') ?? ''
  const so = params?.get('so') ?? ''
  const msg = params?.get('msg') ?? ''

  if (status === 'ok') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          {type === 'so' ? (
            <>
              <h1 className="text-xl font-bold text-gray-900">Order Confirmed!</h1>
              <p className="text-gray-500 text-sm">
                Thank you for confirming Sales Order <span className="font-mono font-semibold text-red-600">{ref}</span>.
              </p>
              <p className="text-gray-500 text-sm">
                A confirmation email has been sent to you. Our team will process your order promptly.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900">Quotation Confirmed!</h1>
              <p className="text-gray-500 text-sm">
                Thank you for confirming Quotation <span className="font-mono font-semibold text-indigo-600">{ref}</span>.
              </p>
              {so && (
                <p className="text-gray-500 text-sm">
                  Your Sales Order <span className="font-mono font-semibold text-red-600">{so}</span> has been created and is now being processed.
                </p>
              )}
              <p className="text-gray-500 text-sm">
                A confirmation email has been sent to you with your order details.
              </p>
            </>
          )}
          <div className="pt-2">
            <div className="inline-block bg-green-50 text-green-700 text-xs font-semibold px-4 py-2 rounded-full border border-green-200">
              ✓ Confirmation received
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'already') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Already Confirmed</h1>
          <p className="text-gray-500 text-sm">
            {type === 'so' ? 'Sales Order' : 'Quotation'}{' '}
            <span className="font-mono font-semibold">{ref}</span> has already been confirmed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10 max-w-md w-full text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
        <p className="text-gray-500 text-sm">{msg || 'Unable to process your confirmation. Please contact us directly.'}</p>
      </div>
    </div>
  )
}
