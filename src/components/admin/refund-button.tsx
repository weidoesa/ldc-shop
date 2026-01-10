'use client'

import { Button } from "@/components/ui/button"
import { getRefundParams, markOrderRefunded, proxyRefund } from "@/actions/refund"
import { useState } from "react"
import { toast } from "sonner"
import { Loader2, ExternalLink, CheckCircle } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"

export function RefundButton({ order }: { order: any }) {
    const [loading, setLoading] = useState(false)
    const [showMarkDone, setShowMarkDone] = useState(false)
    const { t } = useI18n()

    if (order.status !== 'delivered' && order.status !== 'paid') return null
    if (!order.tradeNo) return null

    const handleRefund = async () => {
        if (!confirm(t('admin.orders.refundConfirm'))) return

        setLoading(true)
        try {
            const params = await getRefundParams(order.orderId)

            // Create and submit form in new tab
            const form = document.createElement('form')
            form.method = 'POST'
            form.action = 'https://credit.linux.do/epay/api.php'
            form.target = '_blank'

            Object.entries(params).forEach(([k, v]) => {
                const input = document.createElement('input')
                input.type = 'hidden'
                input.name = k
                input.value = String(v)
                form.appendChild(input)
            })

            document.body.appendChild(form)
            form.submit()
            document.body.removeChild(form)

            setShowMarkDone(true)
            toast.info(t('admin.orders.refundInfo'))
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleProxyRefund = async () => {
        if (!confirm(t('admin.orders.refundProxyConfirm'))) return
        setLoading(true)
        try {
            const result = await proxyRefund(order.orderId)
            if (result.processed) {
                toast.success(t('admin.orders.refundSuccess'))
            } else {
                toast.info(t('admin.orders.refundProxyNotProcessed'))
                setShowMarkDone(true)
            }
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleMarkDone = async () => {
        if (!confirm(t('admin.orders.refundVerify'))) return

        setLoading(true)
        try {
            await markOrderRefunded(order.orderId)
            toast.success(t('admin.orders.refundSuccess'))
            setShowMarkDone(false)
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleVerify = async () => {
        setLoading(true)
        try {
            // Dynamically import to avoid server-side deps in client if any, but actions are safe.
            // We need to import the action.
            // Since it's a client component, we pass the action or import it.
            // AdminOrdersContent imports deleteOrders from admin-orders, so we can verify.
            // Wait, RefundButton imports from @/actions/refund. verifyOrderRefundStatus is in admin-orders.
            // I need to update imports first.
        } catch (e) { }
    }

