import { InferSelectModel } from 'drizzle-orm';
import { users } from '../db/schema';

type User = InferSelectModel<typeof users>;

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
