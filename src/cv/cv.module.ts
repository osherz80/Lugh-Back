import { Module } from '@nestjs/common';
import { CVController } from './cv.contorller';
import { CVService } from './cv.service';

@Module({
    controllers: [CVController],
    providers: [CVService],
})
export class CVModule { }
