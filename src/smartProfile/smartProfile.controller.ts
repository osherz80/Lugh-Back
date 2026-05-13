import { Controller, Post, Body } from '@nestjs/common';
import { SmartProfileService } from './smartProfile.service';


@Controller('smartProfile')
export class SmartProfileController {
    constructor(private readonly smartProfileService: SmartProfileService) { }
    @Post('/create')
    async create(@Body() body: any) {

    }
}
