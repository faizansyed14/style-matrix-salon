// Employee Dashboard Logic

// Check authentication
const user = requireAuth('employee');
if (!user) {
    throw new Error('Unauthorized');
}

// Note: employee_id can be null - allow login but show warning
if (!user.employee_id) {
    console.warn('Employee ID not found for user:', user.email);
    // Don't block access, but some features may not work
}

let refreshInterval;

// Load today's data
async function loadTodayData() {
    try {
        const startOfDay = getStartOfDay(new Date());
        const endOfDay = getEndOfDay(new Date());
        
        // Fetch all transactions (no employee filter)
        const { data: transactions, error } = await window.supabaseClient
            .from('transactions')
            .select(`
                *,
                employees(name),
                transaction_items(service_name, price, quantity)
            `)
            .gte('transaction_date', startOfDay.toISOString())
            .lte('transaction_date', endOfDay.toISOString())
            .order('transaction_date', { ascending: false });
        
        if (error) throw error;
        
        // Calculate totals
        let totalSales = 0;
        let cashTotal = 0;
        let cardTotal = 0;
        let tipsTotal = 0;
        
        transactions.forEach(transaction => {
            totalSales += parseFloat(transaction.subtotal);
            tipsTotal += parseFloat(transaction.tips || 0);
            
            if (transaction.payment_method === 'cash') {
                cashTotal += parseFloat(transaction.subtotal);
            } else {
                cardTotal += parseFloat(transaction.subtotal);
            }
        });
        
        // Calculate split tips (50/50)
        const employeeTips = tipsTotal * 0.5;
        const businessTips = tipsTotal * 0.5;
        
        // Update summary cards
        document.getElementById('totalSales').textContent = formatCurrency(totalSales);
        document.getElementById('cashTotal').textContent = formatCurrency(cashTotal);
        document.getElementById('cardTotal').textContent = formatCurrency(cardTotal);
        document.getElementById('transactionCount').textContent = transactions.length;
        document.getElementById('employeeTipsTotal').textContent = formatCurrency(employeeTips);
        document.getElementById('businessTipsTotal').textContent = formatCurrency(businessTips);
        
        // Update transactions table
        updateTransactionsTable(transactions);
        
        // Update last refresh time (in GST)
        const now = new Date();
        const gstTime = formatTime(now);
        console.log('Last updated - Local time:', now.toLocaleTimeString(), 'GST time:', gstTime);
        document.getElementById('lastUpdate').textContent = `Last updated: ${gstTime}`;
        
    } catch (error) {
        console.error('Error loading today data:', error);
        showToast('Error loading data: ' + error.message, 'error');
    }
}

// Update transactions table
function updateTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsTable');
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">No transactions today</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => {
        const employeeName = transaction.employees?.name || 'Unknown';
        const serviceNames = transaction.transaction_items
            ?.map(item => `${item.service_name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`)
            .join(', ') || 'N/A';
        const paymentBadge = transaction.payment_method === 'cash' 
            ? '<span class="badge badge-cash">Cash</span>'
            : '<span class="badge badge-card">Card</span>';
        const transactionTips = parseFloat(transaction.tips || 0);
        const employeeTip = transactionTips * 0.5;
        const businessTip = transactionTips * 0.5;
        const tipsDisplay = transactionTips > 0 
            ? `<div style="font-size: 12px;">
                <div style="color: var(--success); font-weight: 600;">${formatCurrency(transactionTips)}</div>
                <div style="color: var(--text-secondary);">${formatCurrency(employeeTip)} / ${formatCurrency(businessTip)}</div>
               </div>`
            : '-';
        
        return `
            <tr>
                <td>${formatTime(transaction.transaction_date)}</td>
                <td>${serviceNames}</td>
                <td>${employeeName}</td>
                <td>${paymentBadge}</td>
                <td>${tipsDisplay}</td>
                <td><strong>${formatCurrency(transaction.total)}</strong></td>
            </tr>
        `;
    }).join('');
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadTodayData();
    
    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(loadTodayData, 30000);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

