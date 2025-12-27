// Admin Employees Management Logic

// Check authentication
const user = requireAuth('admin');
if (!user) {
    throw new Error('Unauthorized');
}

// Load employees list
async function loadEmployees() {
    try {
        const { data: employees, error } = await window.supabaseClient
            .from('employees')
            .select('*')
            .order('is_active', { ascending: false })
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        displayEmployees(employees);
    } catch (error) {
        console.error('Error loading employees:', error);
        showToast('Error loading employees: ' + error.message, 'error');
        document.getElementById('employeesList').innerHTML = '<p style="text-align: center; color: var(--error);">Error loading employees</p>';
    }
}

// Display employees
function displayEmployees(employees) {
    const container = document.getElementById('employeesList');
    
    if (employees.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">No employees found</p>';
        return;
    }
    
    container.innerHTML = employees.map(employee => {
        const isActive = employee.is_active !== false;
        const statusBadge = isActive 
            ? '<span class="employee-status-badge employee-status-active">Active</span>'
            : '<span class="employee-status-badge employee-status-inactive">Inactive</span>';
        const actionButton = isActive
            ? `<button class="btn btn-danger btn-sm" onclick="deactivateEmployee('${employee.id}')">Deactivate</button>`
            : `<button class="btn btn-success btn-sm" onclick="activateEmployee('${employee.id}')">Activate</button>`;
        
        return `
        <div class="employee-card ${!isActive ? 'employee-card-inactive' : ''}">
            <div class="employee-card-header">
                <div>
                    <div class="employee-name">
                        ${employee.name}
                        ${statusBadge}
                    </div>
                    <div class="employee-phone">${employee.phone}</div>
                </div>
            </div>
            <div class="employee-actions">
                <button class="btn btn-primary btn-sm" onclick="openEditModal('${employee.id}', '${employee.name.replace(/'/g, "\\'")}', '${employee.phone}')">Edit</button>
                ${actionButton}
            </div>
        </div>
    `;
    }).join('');
}

// Create employee
document.getElementById('employeeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('employeeName').value.trim();
    const phone = document.getElementById('employeePhone').value.trim();
    
    // Validate
    if (!name) {
        showToast('Employee name is required', 'error');
        return;
    }
    
    if (!isValidPhone(phone)) {
        showToast('Please enter a valid phone number', 'error');
        return;
    }
    
    try {
        const { data, error } = await window.supabaseClient
            .from('employees')
            .insert([
                {
                    name: name,
                    phone: phone
                }
            ])
            .select()
            .single();
        
        if (error) throw error;
        
        showToast('Employee created successfully', 'success');
        document.getElementById('employeeForm').reset();
        loadEmployees();
    } catch (error) {
        console.error('Error creating employee:', error);
        showToast('Error creating employee: ' + error.message, 'error');
    }
});

// Open edit modal
function openEditModal(employeeId, name, phone) {
    document.getElementById('editEmployeeId').value = employeeId;
    document.getElementById('editEmployeeName').value = name;
    document.getElementById('editEmployeePhone').value = phone;
    document.getElementById('editModal').classList.add('show');
}

// Close edit modal
function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    document.getElementById('editForm').reset();
}

// Update employee
document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const employeeId = document.getElementById('editEmployeeId').value;
    const name = document.getElementById('editEmployeeName').value.trim();
    const phone = document.getElementById('editEmployeePhone').value.trim();
    
    if (!name) {
        showToast('Employee name is required', 'error');
        return;
    }
    
    if (!isValidPhone(phone)) {
        showToast('Please enter a valid phone number', 'error');
        return;
    }
    
    try {
        const { error } = await window.supabaseClient
            .from('employees')
            .update({ name, phone })
            .eq('id', employeeId);
        
        if (error) throw error;
        
        showToast('Employee updated successfully', 'success');
        closeEditModal();
        loadEmployees();
    } catch (error) {
        console.error('Error updating employee:', error);
        showToast('Error updating employee: ' + error.message, 'error');
    }
});

// Deactivate employee
async function deactivateEmployee(employeeId) {
    const confirmed = await confirmAction(
        'Are you sure you want to deactivate this employee?',
        'Deactivate Employee'
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const { error } = await window.supabaseClient
            .from('employees')
            .update({ is_active: false })
            .eq('id', employeeId);
        
        if (error) throw error;
        
        showToast('Employee deactivated successfully', 'success');
        loadEmployees();
    } catch (error) {
        console.error('Error deactivating employee:', error);
        showToast('Error deactivating employee: ' + error.message, 'error');
    }
}

// Activate employee
async function activateEmployee(employeeId) {
    const confirmed = await confirmAction(
        'Are you sure you want to activate this employee?',
        'Activate Employee'
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const { error } = await window.supabaseClient
            .from('employees')
            .update({ is_active: true })
            .eq('id', employeeId);
        
        if (error) throw error;
        
        showToast('Employee activated successfully', 'success');
        loadEmployees();
    } catch (error) {
        console.error('Error activating employee:', error);
        showToast('Error activating employee: ' + error.message, 'error');
    }
}

// Close modal on outside click
document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') {
        closeEditModal();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadEmployees();
});

