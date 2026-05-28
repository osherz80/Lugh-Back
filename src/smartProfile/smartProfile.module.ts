import { Module } from '@nestjs/common';
import { SmartProfileController } from './smartProfile.controller';
import { SmartProfileService } from './smartProfile.service';

@Module({
    controllers: [SmartProfileController],
    providers: [SmartProfileService],
    exports: [SmartProfileService]
})
export class SmartProfileModule { }
