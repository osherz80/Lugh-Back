import { FullUser, SmartProfile } from 'src/common/types/general';

export class UserDto {
    id: string;
    username: string;
    email: string;
    profilePicture: string | null;
    hasCv: boolean;
    smartProfiles: SmartProfile[];

    constructor(user: FullUser) {
        this.id = user.id;
        this.username = user.username;
        this.email = user.email;
        this.profilePicture = user.profilePicture;
        this.smartProfiles = user.smartProfiles || [];
        this.hasCv = false;

        if (user.smartProfiles && user.smartProfiles.length > 0) {
            this.hasCv = true;
        }
    }
}