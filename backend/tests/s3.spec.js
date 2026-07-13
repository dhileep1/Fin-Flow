describe('S3 Service Upload Behavior', () => {
    let env;

    beforeEach(() => {
        jest.resetModules();
        env = require('../src/config/env');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should fallback to mock URL and log message if AWS credentials or bucket name are missing', async () => {
        // Arrange
        env.awsAccessKeyId = null;
        env.awsSecretAccessKey = null;
        env.s3BucketName = null;

        // Spy on console.log
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        // Import the service after env is modified and modules are reset
        const { uploadReceiptToS3 } = require('../src/services/receipt.service');

        // Act
        const receiptId = 'test-receipt-id-123';
        const pdfBuffer = Buffer.from('PDF Content');
        const url = await uploadReceiptToS3(receiptId, pdfBuffer);

        // Assert
        expect(url).toBe(`https://s3.amazonaws.com/mock-bucket/receipts/${receiptId}.pdf`);
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('[S3 Mock] Mock uploading receipt test-receipt-id-123')
        );
    });

    it('should call S3Client.send with correct PutObjectCommand payload if credentials and bucket name are set', async () => {
        // Arrange
        env.awsAccessKeyId = 'test-access-key';
        env.awsSecretAccessKey = 'test-secret-key';
        env.s3BucketName = 'my-test-bucket';
        env.awsRegion = 'us-west-2';

        // Use doMock to mock client-s3 dynamically without hoisting
        const mockSend = jest.fn().mockResolvedValue({});
        const mockPutObjectCommand = jest.fn().mockImplementation((args) => args);

        jest.doMock('@aws-sdk/client-s3', () => {
            return {
                S3Client: jest.fn().mockImplementation(() => {
                    return {
                        send: mockSend
                    };
                }),
                PutObjectCommand: mockPutObjectCommand
            };
        });

        // Import the service and PutObjectCommand
        const { uploadReceiptToS3 } = require('../src/services/receipt.service');
        const { PutObjectCommand } = require('@aws-sdk/client-s3');

        // Act
        const receiptId = 'real-receipt-id-456';
        const pdfBuffer = Buffer.from('Real PDF Data');
        const url = await uploadReceiptToS3(receiptId, pdfBuffer);

        // Assert
        expect(url).toBe(`https://my-test-bucket.s3.us-west-2.amazonaws.com/receipts/${receiptId}.pdf`);
        expect(mockPutObjectCommand).toHaveBeenCalledWith({
            Bucket: 'my-test-bucket',
            Key: `receipts/${receiptId}.pdf`,
            Body: pdfBuffer,
            ContentType: 'application/pdf',
        });
        expect(mockSend).toHaveBeenCalled();
    });
});
