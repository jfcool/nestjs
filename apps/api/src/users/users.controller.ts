import { Controller, Get, Post, Body, Param, Put, Delete, NotFoundException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags, ApiCreatedResponse, ApiParam } from '@nestjs/swagger';
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
  async getUsers(): Promise<UserDto[]> {
    return this.users.findAll();
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getUserById' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiOkResponse({ type: UserDto })
  async getUserById(@Param('id') id: string): Promise<UserDto> {
    const user = await this.users.findById(parseInt(id, 10));
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  @Post()
  @ApiOperation({ operationId: 'createUser' })
  @ApiCreatedResponse({ type: UserDto })
  async create(@Body() dto: CreateUserDto): Promise<UserDto> {
    return this.users.create(dto);
  }

  @Put(':id')
  @ApiOperation({ operationId: 'updateUser' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiOkResponse({ type: UserDto })
  async updateUser(@Param('id') id: string, @Body() dto: Partial<CreateUserDto>): Promise<UserDto> {
    const user = await this.users.update(parseInt(id, 10), dto);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  @Delete(':id')
  @ApiOperation({ operationId: 'deleteUser' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiOkResponse({ type: 'boolean' })
  async deleteUser(@Param('id') id: string): Promise<{ deleted: boolean }> {
    const deleted = await this.users.delete(parseInt(id, 10));
    if (!deleted) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return { deleted };
  }
}
