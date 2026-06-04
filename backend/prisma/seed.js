const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create organization
    const orgId = uuidv4();
    const org = await prisma.organization.create({
        data: {
            id: orgId,
            name: 'QuickLoans Pvt Ltd',
            phone: '+91 9876543210',
            address: '123, MG Road, Bangalore, Karnataka 560001',
            settings: {
                interest_on: 'gross_principal',
                penalty_compounding: false,
                payment_application_order: ['penalty', 'interest', 'principal'],
                notification_cadence: { reminder_days_before: [7, 1, 0] },
            },
        },
    });
    console.log(`✅ Organization: ${org.name} (${org.id})`);

    // Create admin user
    const adminId = uuidv4();
    const passwordHash = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.create({
        data: {
            id: adminId,
            orgId,
            name: 'Admin User',
            email: 'admin@quickloans.com',
            phone: '9876543210',
            passwordHash,
            role: 'admin',
        },
    });
    console.log(`✅ Admin user: ${admin.email} / admin123`);

    // Create staff user
    const staffId = uuidv4();
    const staffHash = await bcrypt.hash('staff123', 12);
    const staff = await prisma.user.create({
        data: {
            id: staffId,
            orgId,
            name: 'Ramesh Kumar',
            email: 'ramesh@quickloans.com',
            phone: '9876543211',
            passwordHash: staffHash,
            role: 'staff',
        },
    });
    console.log(`✅ Staff user: ${staff.email} / staff123`);

    // Create customers
    const customers = [];
    const customerData = [
        { name: 'Suresh Babu', phone: '9988776655', address: '45, 2nd Cross, Jayanagar, Bangalore' },
        { name: 'Lakshmi Devi', phone: '9988776644', address: '78, 4th Main, Malleshwaram, Bangalore', aadharNumber: '1234-5678-9012' },
        { name: 'Rajesh Kumar', phone: '9988776633', address: '12, Palace Road, Mysore' },
        { name: 'Meena Kumari', phone: '9988776622', address: '56, Station Road, Hubli', aadharNumber: '2345-6789-0123' },
        { name: 'Venkatesh Reddy', phone: '9988776611', address: '90, MG Road, Hyderabad' },
    ];

    for (const cd of customerData) {
        const c = await prisma.customer.create({
            data: { id: uuidv4(), orgId, ...cd },
        });
        customers.push(c);
    }
    console.log(`✅ ${customers.length} customers created`);

    // Create vehicles
    const vehicles = [];
    const vehicleData = [
        { customerId: customers[0].id, vehicleNumber: 'KA-01-AB-1234', model: 'Honda Activa', engineNumber: 'ENG001', chassisNumber: 'CHS001' },
        { customerId: customers[1].id, vehicleNumber: 'KA-02-CD-5678', model: 'TVS Jupiter', engineNumber: 'ENG002', chassisNumber: 'CHS002' },
        { customerId: customers[2].id, vehicleNumber: 'KA-03-EF-9012', model: 'Bajaj Pulsar', engineNumber: 'ENG003', chassisNumber: 'CHS003' },
        { customerId: customers[3].id, vehicleNumber: 'KA-04-GH-3456', model: 'Royal Enfield', engineNumber: 'ENG004', chassisNumber: 'CHS004' },
        { customerId: customers[4].id, vehicleNumber: 'KA-05-IJ-7890', model: 'Suzuki Access', engineNumber: 'ENG005', chassisNumber: 'CHS005' },
    ];

    for (const vd of vehicleData) {
        const v = await prisma.vehicle.create({
            data: { id: uuidv4(), orgId, ...vd },
        });
        vehicles.push(v);
    }
    console.log(`✅ ${vehicles.length} vehicles created`);

    // Helper: generate loan schedule
    function generateSchedule(P, N, r, startDate) {
        const monthlyPrincipal = Math.round((P / N) * 100) / 100;
        const monthlyInterest = Math.round((P * r) * 100) / 100;
        const dues = [];
        for (let i = 1; i <= N; i++) {
            const principalDue = i < N ? monthlyPrincipal : Math.round((P - monthlyPrincipal * (N - 1)) * 100) / 100;
            const interestDue = monthlyInterest;
            const totalDue = Math.round((principalDue + interestDue) * 100) / 100;
            const dueDate = new Date(startDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            dues.push({ dueSequence: i, dueDate, principalDue, interestDue, totalDue });
        }
        return { monthlyPrincipal, monthlyInterest, dues };
    }

    // Create loans
    const loanConfigs = [
        { idx: 0, P: 100000, N: 12, r: 0.02, startDate: '2025-12-01', staffId },
        { idx: 1, P: 200000, N: 24, r: 0.015, startDate: '2025-11-15', staffId },
        { idx: 2, P: 50000, N: 6, r: 0.025, startDate: '2026-01-01', staffId: null },
        { idx: 3, P: 150000, N: 18, r: 0.02, startDate: '2025-10-01', staffId },
        { idx: 4, P: 75000, N: 12, r: 0.02, startDate: '2026-02-01', staffId: null },
    ];

    for (const lc of loanConfigs) {
        const { monthlyPrincipal, monthlyInterest, dues } = generateSchedule(lc.P, lc.N, lc.r, lc.startDate);
        const documentFee = Math.round(lc.P * 0.05 * 100) / 100;
        const disbursed = Math.round((lc.P - documentFee) * 100) / 100;
        const monthlyDue = Math.round((monthlyPrincipal + monthlyInterest) * 100) / 100;
        const firstDueDate = new Date(lc.startDate);
        firstDueDate.setMonth(firstDueDate.getMonth() + 1);

        const loanId = uuidv4();
        await prisma.loan.create({
            data: {
                id: loanId,
                orgId,
                customerId: customers[lc.idx].id,
                vehicleId: vehicles[lc.idx].id,
                assignedStaffId: lc.staffId,
                principalAmount: lc.P,
                tenureMonths: lc.N,
                monthlyInterestRate: lc.r,
                monthlyInterestAmount: monthlyInterest,
                monthlyPrincipalAmount: monthlyPrincipal,
                monthlyDueAmount: monthlyDue,
                startDate: new Date(lc.startDate),
                nextDueDate: firstDueDate,
                outstandingPrincipal: lc.P,
                documentFee,
                disbursedAmount: disbursed,
            },
        });

        // Create loan dues
        for (const due of dues) {
            await prisma.loanDue.create({
                data: {
                    id: uuidv4(),
                    orgId,
                    loanId,
                    dueSequence: due.dueSequence,
                    dueDate: due.dueDate,
                    principalDue: due.principalDue,
                    interestDue: due.interestDue,
                    totalDue: due.totalDue,
                    status: due.dueDate < new Date() ? 'pending' : 'upcoming',
                },
            });
        }

        // Create call task
        await prisma.callTask.create({
            data: {
                id: uuidv4(),
                orgId,
                loanId,
                assignedStaffId: lc.staffId,
                nextCallDate: firstDueDate,
            },
        });

        // Create guarantor for some loans
        if (lc.idx < 3) {
            await prisma.guarantor.create({
                data: {
                    id: uuidv4(),
                    orgId,
                    loanId,
                    name: `Guarantor for ${customers[lc.idx].name}`,
                    phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
                    address: `Same area as ${customers[lc.idx].name}`,
                },
            });
        }
    }
    console.log(`✅ ${loanConfigs.length} loans with schedules, call tasks, and guarantors created`);

    console.log('\n🎉 Seed complete!\n');
    console.log('=== Login Credentials ===');
    console.log(`Org ID: ${orgId}`);
    console.log('Admin: admin@quickloans.com / admin123');
    console.log('Staff: ramesh@quickloans.com / staff123');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
