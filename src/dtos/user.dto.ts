import { FullUser } from 'src/common/types/general';

export class UserDto {
    id: string;
    username: string | null;
    email: string;
    profilePicture: string | null;
    hasCvs: boolean;
    candidate?: {
        userId: string;
        name: string;
        cvs: {
            id: string;
            content: string;
            createdAt: Date | null;
        }[];
    } | null;

    constructor(user: FullUser) {
        this.id = user.id;
        this.username = user.username;
        this.email = user.email;
        this.profilePicture = user.profilePicture;
        this.hasCvs = false;

        if (user.candidate?.cvs && user.candidate.cvs.length > 0) {
            this.hasCvs = true;
        }
    }
}