import { Module } from '@nestjs/common';
import { CVController } from './cvs.contorller';
import { CVService } from './cvs.service';

@Module({
    controllers: [CVController],
    providers: [CVService],
})
export class CVModule { }
