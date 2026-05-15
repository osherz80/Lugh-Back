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
    @Get(':profileId')
    async getSmartProfileById(@UserId() userId: string, @Param() params: { profileId: string }) {
        return await this.smartProfileService.getSmartProfileById(userId, params.profileId);
    }
    @Get('/all')
    async getAllSmartProfilesByUser(@UserId() userId: string) {
        return await this.smartProfileService.getAllSmartProfilesByUser(userId);
    }
    @Patch()
    async upsertSmartProfile(@UserId() userId: string, @Body() body: Partial<FullSmartProfile> & { section: SmartProfileSection }) {
        return await this.smartProfileService.handleUpsert(body, body.section, userId);
    }
}
