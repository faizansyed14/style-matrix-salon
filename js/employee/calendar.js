// Employee Calendar Logic

// Check authentication
const user = requireAuth('employee');
if (!user) {
    throw new Error('Unauthorized');
}

// Note: employee_id can be null - allow access but show warning
if (!user.employee_id) {
    console.warn('Employee ID not found for user:', user.email);
    // Don't block access, but some features may not work
}

let currentDate = new Date();
let selectedDate = null;
let transactionCounts = {};

// Initialize calendar
document.addEventListener('DOMContentLoaded', () => {
    loadTransactionCounts();
    renderCalendar();
});

// Load transaction counts for the current month
async function loadTransactionCounts() {
    try {
        const year = currentDate.getFullYear();
        const monthIndex = currentDate.getMonth();
        
        // Create start and end of month dates in GST
        const monthStartDate = new Date(year, monthIndex, 1);
        const monthEndDate = new Date(year, monthIndex + 1, 0); // Last day of month
        
        const monthStartGST = getStartOfDay(monthStartDate);
        const monthEndGST = getEndOfDay(monthEndDate);
        
        const startISO = monthStartGST.toISOString();
        const endISO = monthEndGST.toISOString();
        
        console.log('Employee calendar - Loading transactions for month:', getMonthName(monthIndex), year);
        console.log('Employee calendar - Month range (UTC):', startISO, 'to', endISO);
        
        
        const { data: transactions, error } = await window.supabaseClient
            .from('transactions')
            .select('transaction_date')
            .gte('transaction_date', startISO)
            .lte('transaction_date', endISO);
        
        if (error) {
            console.error('Error loading transaction counts:', error);
            throw error;
        }
        
        console.log('Employee calendar - Transactions found:', transactions?.length || 0);
        if (transactions && transactions.length > 0) {
            console.log('Employee calendar - Transaction dates:', transactions.map(t => t.transaction_date));
        } else {
            console.warn('Employee calendar - No transactions in range. Checking date comparison...');
        }
        
        // Count transactions per day (using GST timezone)
        transactionCounts = {};
        if (transactions && transactions.length > 0) {
            transactions.forEach(transaction => {
                const utcDate = new Date(transaction.transaction_date);
                const gstDate = getGSTDate(utcDate);
                const dateKey = `${gstDate.getFullYear()}-${gstDate.getMonth()}-${gstDate.getDate()}`;
                transactionCounts[dateKey] = (transactionCounts[dateKey] || 0) + 1;
            });
            console.log('Employee calendar - Transaction counts:', transactionCounts);
        }
        
        renderCalendar();
    } catch (error) {
        console.error('Error loading transaction counts:', error);
        showToast('Error loading calendar data', 'error');
    }
}

// Render calendar
function renderCalendar() {
    const year = currentDate.getFullYear();
    const monthIndex = currentDate.getMonth();
    
    // Update month/year header
    document.getElementById('calendarMonthYear').textContent = `${getMonthName(monthIndex)} ${year}`;
    
    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';
    
    // Day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });
    
    // Get first day of month and days in month
    const firstDay = getFirstDayOfMonth(year, monthIndex);
    const daysInMonth = getDaysInMonth(year, monthIndex);
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
    
    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        calendarGrid.appendChild(emptyDay);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        const dateKey = `${year}-${monthIndex}-${day}`;
        const isToday = isCurrentMonth && day === today.getDate();
        const hasTransactions = transactionCounts[dateKey] > 0;
        
        if (isToday) {
            dayElement.classList.add('today');
        }
        
        dayElement.innerHTML = `
            <div class="calendar-day-number">${day}</div>
            ${hasTransactions ? '<div class="calendar-day-badge"></div>' : ''}
        `;
        
        dayElement.addEventListener('click', () => {
            const clickedDate = new Date(year, monthIndex, day);
            // Remove selected class from all days
            document.querySelectorAll('.calendar-day.selected').forEach(d => d.classList.remove('selected'));
            // Add selected class to clicked day
            dayElement.classList.add('selected');
            selectDate(clickedDate);
        });
        
        calendarGrid.appendChild(dayElement);
    }
}

// Select date and show details
async function selectDate(date) {
    selectedDate = date;
    await loadDateDetails(date);
    document.getElementById('dateDetailsSection').style.display = 'block';
    // Scroll to details section
    document.getElementById('dateDetailsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Load date details
async function loadDateDetails(date) {
    try {
        const dayStartGST = getStartOfDay(date);
        const dayEndGST = getEndOfDay(date);
        
        const startISO = dayStartGST.toISOString();
        const endISO = dayEndGST.toISOString();
        
        // Update details title
        const dateStr = formatDate(date);
        document.getElementById('dateDetailsTitle').textContent = `Date: ${dateStr}`;
        
        console.log('Employee calendar - Loading date details for:', dateStr);
        console.log('Employee calendar - Date range (UTC):', startISO, 'to', endISO);
        
        
        // Fetch all transactions for the day (no employee filter)
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
            console.error('Employee calendar - Error fetching transactions:', error);
            throw error;
        }
        
        console.log('Employee calendar - Date details transactions found:', transactions?.length || 0);
        
        // Calculate totals
        let totalSales = 0;
        let cashTotal = 0;
        let cardTotal = 0;
        let tipsTotal = 0;
        const employeeStats = {};
        
        transactions.forEach(transaction => {
            totalSales += parseFloat(transaction.subtotal);
            tipsTotal += parseFloat(transaction.tips || 0);
            
            if (transaction.payment_method === 'cash') {
                cashTotal += parseFloat(transaction.subtotal);
            } else {
                cardTotal += parseFloat(transaction.subtotal);
            }
            
            // Employee stats
            const employeeName = transaction.employees?.name || 'Unknown';
            if (!employeeStats[employeeName]) {
                employeeStats[employeeName] = {
                    transactions: 0,
                    cashTotal: 0,
                    cardTotal: 0,
                    tips: 0
                };
            }
            
            employeeStats[employeeName].transactions++;
            if (transaction.payment_method === 'cash') {
                employeeStats[employeeName].cashTotal += parseFloat(transaction.subtotal);
            } else {
                employeeStats[employeeName].cardTotal += parseFloat(transaction.subtotal);
            }
            employeeStats[employeeName].tips += parseFloat(transaction.tips || 0);
        });
        
        // Display details
        const detailsHTML = `
            <div class="summary-grid" style="margin-bottom: 24px;">
                <div class="summary-card">
                    <div class="summary-card-label">Total Sales (excl. tips)</div>
                    <div class="summary-card-value">${formatCurrency(totalSales)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Employee Tips (50%)</div>
                    <div class="summary-card-value">${formatCurrency(tipsTotal * 0.5)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Business Tips (50%)</div>
                    <div class="summary-card-value">${formatCurrency(tipsTotal * 0.5)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Cash Total</div>
                    <div class="summary-card-value">${formatCurrency(cashTotal)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Card Total</div>
                    <div class="summary-card-value">${formatCurrency(cardTotal)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Transactions</div>
                    <div class="summary-card-value">${transactions.length}</div>
                </div>
            </div>
            
            <h3 style="margin-bottom: 16px;">Employee Performance</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Employee Name</th>
                            <th>Transactions</th>
                            <th>Cash Total</th>
                            <th>Card Total</th>
                            <th>Tips (Total / Employee / Business)</th>
                            <th>Total Sales (excl. tips)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(employeeStats).map(([name, stats]) => {
                            const totalSales = stats.cashTotal + stats.cardTotal;
                            return `
                            <tr>
                                <td><strong>${name}</strong></td>
                                <td>${stats.transactions}</td>
                                <td>${formatCurrency(stats.cashTotal)}</td>
                                <td>${formatCurrency(stats.cardTotal)}</td>
                                <td>
                                    <div style="font-size: 12px;">
                                        <div style="font-weight: 600;">${formatCurrency(stats.tips)}</div>
                                        <div style="color: var(--text-secondary);">${formatCurrency(stats.tips * 0.5)} / ${formatCurrency(stats.tips * 0.5)}</div>
                                    </div>
                                </td>
                                <td><strong>${formatCurrency(totalSales)}</strong></td>
                            </tr>
                        `;
                        }).join('')}
                        ${Object.keys(employeeStats).length === 0 ? '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">No transactions on this date</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;
        
        document.getElementById('dateDetails').innerHTML = detailsHTML;
    } catch (error) {
        console.error('Error loading date details:', error);
        showToast('Error loading date details: ' + error.message, 'error');
    }
}

// Show monthly view
async function showMonthlyView() {
    if (!selectedDate) return;
    
    try {
        const year = selectedDate.getFullYear();
        const monthIndex = selectedDate.getMonth();
        
        // Create start and end of month dates
        const startDate = new Date(year, monthIndex, 1);
        const endDate = new Date(year, monthIndex + 1, 0); // Last day of month
        
        const monthStartGST = getStartOfDay(startDate);
        const monthEndGST = getEndOfDay(endDate);
        
        const startISO = monthStartGST.toISOString();
        const endISO = monthEndGST.toISOString();
        
        console.log('Employee calendar - Loading monthly view for:', getMonthName(monthIndex), year);
        console.log('Employee calendar - Month range (UTC):', startISO, 'to', endISO);
        
        // Fetch all transactions for the month (no employee filter)
        const { data: transactions, error } = await window.supabaseClient
            .from('transactions')
            .select(`
                *,
                employees(name)
            `)
            .gte('transaction_date', startISO)
            .lte('transaction_date', endISO);
        
        if (error) throw error;
        
        // Calculate totals
        let totalSales = 0;
        let cashTotal = 0;
        let cardTotal = 0;
        let tipsTotal = 0;
        const employeeStats = {};
        
        transactions.forEach(transaction => {
            totalSales += parseFloat(transaction.subtotal);
            tipsTotal += parseFloat(transaction.tips || 0);
            
            if (transaction.payment_method === 'cash') {
                cashTotal += parseFloat(transaction.subtotal);
            } else {
                cardTotal += parseFloat(transaction.subtotal);
            }
            
            // Employee stats
            const employeeName = transaction.employees?.name || 'Unknown';
            if (!employeeStats[employeeName]) {
                employeeStats[employeeName] = {
                    transactions: 0,
                    cashTotal: 0,
                    cardTotal: 0,
                    tips: 0
                };
            }
            
            employeeStats[employeeName].transactions++;
            if (transaction.payment_method === 'cash') {
                employeeStats[employeeName].cashTotal += parseFloat(transaction.subtotal);
            } else {
                employeeStats[employeeName].cardTotal += parseFloat(transaction.subtotal);
            }
            employeeStats[employeeName].tips += parseFloat(transaction.tips || 0);
        });
        
        // Update details title
        document.getElementById('dateDetailsTitle').textContent = `Month: ${getMonthName(monthIndex)} ${year}`;
        
        // Display monthly details
        const detailsHTML = `
            <div class="summary-grid" style="margin-bottom: 24px;">
                <div class="summary-card">
                    <div class="summary-card-label">Total Sales (excl. tips)</div>
                    <div class="summary-card-value">${formatCurrency(totalSales)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Employee Tips (50%)</div>
                    <div class="summary-card-value">${formatCurrency(tipsTotal * 0.5)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Business Tips (50%)</div>
                    <div class="summary-card-value">${formatCurrency(tipsTotal * 0.5)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Cash Total</div>
                    <div class="summary-card-value">${formatCurrency(cashTotal)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Card Total</div>
                    <div class="summary-card-value">${formatCurrency(cardTotal)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Transactions</div>
                    <div class="summary-card-value">${transactions.length}</div>
                </div>
            </div>
            
            <h3 style="margin-bottom: 16px;">Employee Performance</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Employee Name</th>
                            <th>Transactions</th>
                            <th>Cash Total</th>
                            <th>Card Total</th>
                            <th>Tips (Total / Employee / Business)</th>
                            <th>Total Sales (excl. tips)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(employeeStats).map(([name, stats]) => {
                            const totalSales = stats.cashTotal + stats.cardTotal;
                            return `
                            <tr>
                                <td><strong>${name}</strong></td>
                                <td>${stats.transactions}</td>
                                <td>${formatCurrency(stats.cashTotal)}</td>
                                <td>${formatCurrency(stats.cardTotal)}</td>
                                <td>
                                    <div style="font-size: 12px;">
                                        <div style="font-weight: 600;">${formatCurrency(stats.tips)}</div>
                                        <div style="color: var(--text-secondary);">${formatCurrency(stats.tips * 0.5)} / ${formatCurrency(stats.tips * 0.5)}</div>
                                    </div>
                                </td>
                                <td><strong>${formatCurrency(totalSales)}</strong></td>
                            </tr>
                        `;
                        }).join('')}
                        ${Object.keys(employeeStats).length === 0 ? '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">No transactions this month</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;
        
        document.getElementById('dateDetails').innerHTML = detailsHTML;
    } catch (error) {
        console.error('Error loading monthly view:', error);
        showToast('Error loading monthly view: ' + error.message, 'error');
    }
}

// Navigation functions
function previousMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    loadTransactionCounts();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    loadTransactionCounts();
}

function goToToday() {
    currentDate = new Date();
    loadTransactionCounts();
}

// Clear date selection
function clearDateSelection() {
    document.getElementById('dateDetailsSection').style.display = 'none';
    selectedDate = null;
    // Remove selected class from calendar days
    document.querySelectorAll('.calendar-day.selected').forEach(day => {
        day.classList.remove('selected');
    });
}

