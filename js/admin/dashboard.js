// Admin Dashboard Logic

// Check authentication
const user = requireAuth('admin');
if (!user) {
    // Redirect handled by requireAuth
    throw new Error('Unauthorized');
}

let refreshInterval;

// Load today's data
async function loadTodayData() {
    try {
        const today = new Date();
        const startOfDay = getStartOfDay(today);
        const endOfDay = getEndOfDay(today);
        
        const startISO = startOfDay.toISOString();
        const endISO = endOfDay.toISOString();
        
        console.log('Loading data for today:', today);
        console.log('GST date:', getGSTDate(today));
        console.log('Start of day (UTC):', startISO);
        console.log('End of day (UTC):', endISO);
        
        // Fetch transactions with related data
        // Use simpler date filtering that works with Supabase timestamps
        const { data: transactions, error } = await window.supabaseClient
            .from('transactions')
            .select(`
                *,
                employees(name),
                transaction_items(service_name, price, quantity)
            `)
            .gte('transaction_date', startISO)
            .lte('transaction_date', endISO)
            .order('transaction_date', { ascending: false });
        
        if (error) {
            console.error('Error fetching transactions:', error);
            throw error;
        }
        
        console.log('Transactions loaded:', transactions); // Debug log
        console.log('Date range:', startOfDay.toISOString(), 'to', endOfDay.toISOString()); // Debug log
        console.log('Today in GST:', getGSTDate(new Date())); // Debug log
        
        // Also fetch all recent transactions for debugging
        const { data: allRecent, error: allError } = await window.supabaseClient
            .from('transactions')
            .select('id, transaction_date, subtotal, total')
            .order('transaction_date', { ascending: false })
            .limit(10);
        
        if (!allError && allRecent) {
            console.log('Last 10 transactions in DB:', allRecent);
            allRecent.forEach(t => {
                const dbDate = new Date(t.transaction_date);
                const gstDate = getGSTDate(dbDate);
                const todayGST = getGSTDate(new Date());
                const isToday = gstDate.getDate() === todayGST.getDate() && 
                               gstDate.getMonth() === todayGST.getMonth() && 
                               gstDate.getFullYear() === todayGST.getFullYear();
                console.log(`Transaction ${t.id}: DB date = ${t.transaction_date}, GST date = ${gstDate.toLocaleString()}, Is today = ${isToday}`);
            });
        }
        
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
        updateTransactionsTable(transactions || []);
        
        // Update last refresh time (in GST)
        const now = new Date();
        const gstTime = formatTime(now);
        console.log('Last updated - Local time:', now.toLocaleTimeString(), 'GST time:', gstTime);
        document.getElementById('lastUpdate').textContent = `Last updated: ${gstTime}`;
        
    } catch (error) {
        console.error('Error loading today data:', error);
        showToast('Error loading data: ' + error.message, 'error');
        // Show empty state
        document.getElementById('totalSales').textContent = formatCurrency(0);
        document.getElementById('cashTotal').textContent = formatCurrency(0);
        document.getElementById('cardTotal').textContent = formatCurrency(0);
        document.getElementById('transactionCount').textContent = '0';
        document.getElementById('employeeTipsTotal').textContent = formatCurrency(0);
        document.getElementById('businessTipsTotal').textContent = formatCurrency(0);
        updateTransactionsTable([]);
    }
}

// Update transactions table
function updateTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsTable');
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary);">No transactions today</td></tr>';
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
                <td>
                    <button 
                        class="btn btn-danger btn-sm" 
                        onclick="deleteTransaction('${transaction.id}')"
                        title="Delete transaction"
                        style="padding: 4px 12px; font-size: 12px;"
                    >
                        Delete
                    </button>
                </td>
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

// Delete transaction (admin only)
async function deleteTransaction(transactionId) {
    const confirmed = await confirmAction(
        'Are you sure you want to delete this transaction? This action cannot be undone and will also delete all associated transaction items.',
        'Delete Transaction'
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        // Delete the transaction (transaction_items will be deleted automatically due to CASCADE)
        const { error } = await window.supabaseClient
            .from('transactions')
            .delete()
            .eq('id', transactionId);
        
        if (error) throw error;
        
        showToast('Transaction deleted successfully', 'success');
        
        // Reload today's data to refresh the table
        await loadTodayData();
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showToast('Error deleting transaction: ' + error.message, 'error');
    }
}

// Make deleteTransaction globally accessible
window.deleteTransaction = deleteTransaction;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

