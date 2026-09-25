import moment from 'moment'
import { monthlyRevenue, averageTimeToPay } from '../lib/reports.js'
import { trialLabel } from '../lib/trial.js'
import { invoiceRow } from './InvoiceRow.js'

export function dashboard(account, invoices) {
  moment.locale('en-gb')
  const yearAgo = moment().subtract(1, 'year').format('YYYY-MM-DD')
  return {
    trial: trialLabel(account.signupAt),
    revenue: monthlyRevenue(invoices, yearAgo, moment().format('YYYY-MM-DD')),
    timeToPay: averageTimeToPay(invoices.filter((i) => i.paidAt)),
    rows: invoices.map(invoiceRow),
  }
}
