import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException, Get, Param } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CVService } from './cvs.service';
import { CVFileValidator } from './cvs.validator';
import { UserId } from 'src/common/decorators/user-id.decorator';


@Controller('cv')
export class CVController {
    constructor(private readonly cvService: CVService) { }

    @Get()
    async getCVs(@UserId() userId: string) {
        return await this.cvService.getCVs(userId);
    }

    @Get(':smartProfileId')
    async getProfileCVs(@UserId() userId: string, @Param('smartProfileId') smartProfileId: string) {
        return await this.cvService.getProfileCVs(userId, smartProfileId);
    }

    @Post('/upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadCV(
        @UploadedFile(new CVFileValidator()) file: Express.Multer.File,
        @UserId() userId: string
    ) {
        if (!file) {
            throw new BadRequestException('No file received!');
        }

        const result = await this.cvService.uploadCv(file, userId);
        return result;
    }
    @Post('/from-profile/:smartProfileId')
    async createCv(@UserId() userId: string, @Param('smartProfileId') smartProfileId: string) {
        return await this.cvService.cvFromSmartProfile(userId, smartProfileId);
    }
    // @Get('display')
    // async getCVsDisplay(@Query('candidateId') candidateId: string) {
    //     const cvs = await this.cvService.getCVsDisplay(candidateId);
    //     return { cvs };
    // }
}
