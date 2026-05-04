import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException, Get, Query, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CVService } from './cvs.service';
import { CVFileValidator } from './cvs.validator';


@Controller('cv')
export class CVController {
    constructor(private readonly cvService: CVService) { }

    @Post('/upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadCV(
        @UploadedFile(new CVFileValidator()) file: Express.Multer.File,
        @Body('userId') userId: string
    ) {
        if (!file) {
            throw new BadRequestException('No file received!');
        }

        const result = await this.cvService.uploadCv(file, userId);
        return result;
    }

    // @Get('display')
    // async getCVsDisplay(@Query('candidateId') candidateId: string) {
    //     const cvs = await this.cvService.getCVsDisplay(candidateId);
    //     return { cvs };
    // }
}
