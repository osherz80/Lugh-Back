import { FullUser } from 'src/common/types/general';

export class UserDto {
    id: string;
    username: string;
    email: string;
    profilePicture: string | null;
    hasCv: boolean;

    constructor(user: FullUser) {
        this.id = user.id;
        this.username = user.username;
        this.email = user.email;
        this.profilePicture = user.profilePicture;
        this.hasCv = false;

        if (user.candidate?.cvs && user.candidate.cvs.length > 0) {
            this.hasCv = true;
        }
    }
}