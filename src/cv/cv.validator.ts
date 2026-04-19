import {
    ParseFilePipe,
    MaxFileSizeValidator,
    FileTypeValidator,
    Injectable,
    ArgumentMetadata,
    BadRequestException
} from '@nestjs/common';

@Injectable()
export class CVFileValidator extends ParseFilePipe {
    constructor() {
        super({
            validators: [
                new MaxFileSizeValidator({
                    maxSize: 1024 * 1024 * 5,
                    message: 'File too large (Max 5MB)'
                }),
                new FileTypeValidator({
                    fileType: /(pdf|vnd.openxmlformats-officedocument.wordprocessingml.document)$/
                }),
            ],
        });
    }

    /**
     * Overriding transform to add Magic Bytes validation.
     * Ensures the file content matches the expected PDF or DOCX binary signatures.
     */
    async transform(value: any, metadata?: ArgumentMetadata): Promise<Express.Multer.File> {
        // Run standard NestJS file validators first
        const file: Express.Multer.File = await super.transform(value);

        const buffer = file.buffer;
        if (!buffer || buffer.length < 4) {
            throw new BadRequestException('Invalid file content: buffer is empty or too small');
        }

        const magic = buffer.toString('hex', 0, 4).toUpperCase();

        const isPDF = magic === '25504446'; // %PDF signature
        const isDocx = magic === '504B0304'; // PK.. (ZIP/DOCX) signature

        if (!isPDF && !isDocx) {
            throw new BadRequestException(
                'File signature mismatch: the binary content does not match the file extension'
            );
        }

        return file;
    }
}