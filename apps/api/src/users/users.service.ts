import { Injectable } from '@nestjs/common';
import { UserDto } from './user.dto';
import { CreateUserDto } from './create-user.dto';

@Injectable()
export class UsersService {
  private readonly data: UserDto[] = [
    { id: 1, name: 'Max Mustermann', email: 'max@example.com' },
    { id: 2, name: 'Erika Musterfrau', email: 'erika@example.com' },
    { id: 3, name: 'Fränki', email: null },
  ];
  private idSeq = 3;

  findAll(): UserDto[] {
    return this.data;
  }

  create(dto: CreateUserDto): UserDto {
    const u: UserDto = {
      id: ++this.idSeq,
      name: dto.name,
      email: dto.email ?? null,
    };
    this.data.push(u);
    return u;
  }
}
