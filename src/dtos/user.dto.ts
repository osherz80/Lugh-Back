import { FullUser } from 'src/common/types/general';

export class UserDto {
    id: string;
    username: string | null;
    email: string;
    profilePicture: string | null;
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

        if (user.candidate) {
            this.candidate = {
                userId: user.candidate.userId,
                name: user.candidate.name,
                cvs: (user.candidate.cvs || []).map(cv => ({
                    id: cv.id,
                    content: cv.content,
                    createdAt: cv.createdAt
                }))
            };
        }
    }
}