import { Controller, Post, Body, Get, Param, Patch } from '@nestjs/common';
import { SmartProfileService } from './smartProfile.service';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { FullSmartProfile, SmartProfile, SmartProfileSection } from 'src/common/types/general';


@Controller('smartProfile')
export class SmartProfileController {
    constructor(private readonly smartProfileService: SmartProfileService) { }

    @Get()
    async getMasterSmartProfile(@UserId() userId: string) {
        return await this.smartProfileService.getMasterSmartProfile(userId);
    }
    @Get('/other')
    async getOtherSmartProfiles(@UserId() userId: string) {
        return await this.smartProfileService.getFullOtherSmartProfiles(userId);
    }
    @Get('/all')
    async getAllSmartProfilesByUser(@UserId() userId: string) {
        return await this.smartProfileService.getAllSmartProfilesByUser(userId);
    }
    @Patch()
    async upsertSmartProfile(@UserId() userId: string, @Body() { stepData, section, profileId }: { stepData: Partial<FullSmartProfile>, section: SmartProfileSection, profileId?: string }) {
        return await this.smartProfileService.handleUpsert(stepData, section, userId, profileId);
    }
    @Patch('/setMaster')
    async setMaster(@UserId() userId: string, @Body() { profileId }: { profileId: string }) {
        return await this.smartProfileService.setMaster(userId, profileId);
    }
}
