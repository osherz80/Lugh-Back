import { Module } from '@nestjs/common';
import { CVController } from './cvs.contorller';
import { CVService } from './cvs.service';
import { SmartProfileModule } from '../smartProfile/smartProfile.module';

@Module({
    imports: [SmartProfileModule],
    controllers: [CVController],
    providers: [CVService],
})
export class CVModule { }
