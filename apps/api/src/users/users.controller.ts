import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags, ApiCreatedResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserDto } from './user.dto';
import { CreateUserDto } from './create-user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ operationId: 'getUsers' })
  @ApiOkResponse({ type: UserDto, isArray: true })
  getUsers(): UserDto[] {
    return this.users.findAll();
  }

  @Post()
  @ApiOperation({ operationId: 'createUser' })
  @ApiCreatedResponse({ type: UserDto })
  create(@Body() dto: CreateUserDto): UserDto {
    return this.users.create(dto);
  }
}
