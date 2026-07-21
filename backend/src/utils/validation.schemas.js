const { z } = require('zod');

// Helpers
const uuidSchema = z.string().uuid("Invalid UUID format");
const dateStringSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
});

const paymentDateSchema = z.string()
    .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" })
    .refine((val) => {
        const payDate = new Date(val);
        const now = new Date();
        return payDate.getTime() <= now.getTime() + 5 * 60 * 1000;
    }, { message: "Payment date cannot be in the future" })
    .refine((val) => {
        const payDate = new Date(val);
        const now = new Date();
        const maxPastAllowed = 3 * 24 * 60 * 60 * 1000;
        return now.getTime() - payDate.getTime() <= maxPastAllowed;
    }, { message: "Payment date cannot be backdated by more than 3 days" })
    .optional();

// Auth schemas
const loginSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email format").optional(),
        phone: z.string().min(5, "Phone number is too short").optional(),
        password: z.string().min(1, "Password is required"),
    }).refine((data) => data.email || data.phone, {
        message: "Either email or phone is required",
        path: ["email"],
    }),
});

// Customer schemas
const createCustomerSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Name is required"),
        phone: z.string().min(10, "Phone number must be at least 10 digits"),
        altPhone: z.array(z.string()).optional(),
        address: z.string().optional().nullable(),
        aadharNumber: z.string().optional().nullable(),
        photoUrl: z.string().url("Invalid photo URL format").optional().nullable().or(z.string().length(0)),
    }),
});

const updateCustomerSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Name is required").optional(),
        phone: z.string().min(10, "Phone number must be at least 10 digits").optional(),
        altPhone: z.array(z.string()).optional(),
        address: z.string().optional().nullable(),
        aadharNumber: z.string().optional().nullable(),
        photoUrl: z.string().url("Invalid photo URL format").optional().nullable().or(z.string().length(0)),
        optOutWhatsapp: z.boolean().optional(),
    }),
});

// Vehicle schemas
const createVehicleSchema = z.object({
    body: z.object({
        customerId: uuidSchema,
        vehicleNumber: z.string().min(1, "Vehicle number is required"),
        model: z.string().optional().nullable(),
        engineNumber: z.string().optional().nullable(),
        chassisNumber: z.string().optional().nullable(),
        rcImageUrl: z.string().url("Invalid RC image URL").optional().nullable().or(z.string().length(0)),
        insuranceValidTill: dateStringSchema.optional().nullable(),
    }),
});

const updateVehicleSchema = z.object({
    body: z.object({
        customerId: uuidSchema.optional(),
        vehicleNumber: z.string().min(1, "Vehicle number is required").optional(),
        model: z.string().optional().nullable(),
        engineNumber: z.string().optional().nullable(),
        chassisNumber: z.string().optional().nullable(),
        rcImageUrl: z.string().url("Invalid RC image URL").optional().nullable().or(z.string().length(0)),
        insuranceValidTill: dateStringSchema.optional().nullable(),
    }),
});

// Seizure schemas
const seizeVehicleSchema = z.object({
    body: z.object({
        vehicleId: uuidSchema,
        loanId: uuidSchema,
        seizedBy: uuidSchema.optional(),
        seizureDate: dateStringSchema.optional(),
        yardLocation: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
    }),
});


// Guarantor Schema (Sub-object)
const guarantorSubSchema = z.object({
    name: z.string().min(1, "Guarantor name is required"),
    phone: z.string().optional().nullable(),
    aadharNumber: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    photoUrl: z.string().optional().nullable(),
});

// Loan schemas
const createLoanSchema = z.object({
    body: z.object({
        customerId: uuidSchema,
        vehicleId: uuidSchema,
        assignedStaffId: uuidSchema.optional(),
        principalAmount: z.number().positive("Principal amount must be positive").max(100000000, "Principal amount cannot exceed 100,000,000"),
        tenureMonths: z.number().int().positive("Tenure months must be a positive integer"),
        monthlyInterestRate: z.number().nonnegative("Monthly interest rate cannot be negative").max(0.05, "Monthly interest rate cannot exceed 5% per month (60% per annum)"),
        startDate: dateStringSchema,
        guarantors: z.array(guarantorSubSchema).optional(),
    }),
});

const forecloseLoanSchema = z.object({
    body: z.object({
        foreclosureRate: z.number().nonnegative("Foreclosure rate cannot be negative"),
        paymentMethod: z.enum(["cash", "upi", "bank", "cheque", "card"], {
            errorMap: () => ({ message: "Invalid payment method" })
        }),
        referenceNumber: z.string().optional().nullable(),
        paymentDate: paymentDateSchema,
    }),
});

// Payment schemas
const createPaymentSchema = z.object({
    body: z.object({
        loanId: uuidSchema,
        amount: z.number().positive("Payment amount must be positive"),
        paymentMethod: z.enum(["cash", "upi", "bank", "cheque", "card"]).optional(),
        referenceNumber: z.string().optional().nullable(),
        paymentDate: paymentDateSchema,
    }),
});

// Expense schemas
const createExpenseSchema = z.object({
    body: z.object({
        amount: z.number().positive("Expense amount must be positive"),
        category: z.enum(["rent", "salary", "utilities", "office", "reconditioning", "towing", "yard", "repairs", "other"], {
            errorMap: () => ({ message: "Invalid category" })
        }),
        description: z.string().optional().nullable(),
        tags: z.array(z.string()).optional(),
        expenseDate: dateStringSchema.optional(),
        vehicleId: uuidSchema.optional().nullable(),
    }),
});

// Notification schemas
const sendNotificationSchema = z.object({
    body: z.object({
        customerId: uuidSchema,
        loanId: uuidSchema.optional(),
        type: z.enum(["reminder", "receipt", "manual"]).optional(),
        messageBody: z.string().min(1, "Message body is required"),
        mediaUrl: z.string().url("Invalid media URL").optional().nullable().or(z.string().length(0)),
    }),
});

const bulkSendNotificationsSchema = z.object({
    body: z.object({
        targetIds: z.array(uuidSchema).min(1, "At least one target recipient is required"),
        messageBody: z.string().min(1, "Message body is required"),
    }),
});

// Call log schemas
const createCallLogSchema = z.object({
    body: z.object({
        callTaskId: uuidSchema,
        outcome: z.enum(["connected", "no_answer", "promise", "rejected"], {
            errorMap: () => ({ message: "Invalid outcome value" })
        }),
        notes: z.string().optional().nullable(),
        promisedPaymentAmount: z.number().positive().optional().nullable(),
        promisedPaymentDate: dateStringSchema.optional().nullable(),
        nextFollowupDate: dateStringSchema.optional().nullable(),
    }),
});

module.exports = {
    loginSchema,
    createCustomerSchema,
    updateCustomerSchema,
    createVehicleSchema,
    updateVehicleSchema,
    seizeVehicleSchema,
    createLoanSchema,
    forecloseLoanSchema,
    createPaymentSchema,
    createExpenseSchema,
    sendNotificationSchema,
    bulkSendNotificationsSchema,
    createCallLogSchema,
};
