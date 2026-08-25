export class UserResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  verified: boolean;
  isAdmin: boolean;
  image: string;
  gamePoints: number;
  createdAt: Date;
}
