import { InferSelectModel } from 'drizzle-orm';
import { user } from '../db/schema';

type User = InferSelectModel<typeof user>;

export class UserDto {
    id: string;
    username: string | null;
    email: string;
    profilePicture: string | null;

    constructor(
        user: User
    ) {
        this.id = user.id;
        this.username = user.username;
        this.email = user.email;
        this.profilePicture = user.profilePicture;
    }
}
