import { RegistrationEntity } from './registration.entity';
import { Inject, Injectable, Scope } from '@nestjs/common';

import { Request } from 'express';
import {
  DataSource,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  Like,
  Repository,
} from 'typeorm';
import { ScopedQueryBuilder } from '../scoped.repository';
import { REQUEST } from '@nestjs/core';
import { RegistrationViewEntity } from './registration-view.entity';

export class RegistrationScopedBaseRepository<T> {
  public readonly repository: Repository<T>;
  public request: Request;

  constructor(target: EntityTarget<T>, dataSource: DataSource) {
    this.repository = dataSource.createEntityManager().getRepository(target);
  }

  public async find(options: FindManyOptions<T>): Promise<T[]> {
    console.log('this.request.scope: ', this.request.scope);
    const scopedOptions = {
      ...options,
      where: [
        {
          ...(options?.where || {}),
          scope: Like(`${this.request.scope}%`),
        },
        {
          ...(options?.where || {}),
          program: { enableScope: false },
        },
      ],
    };
    return this.repository.find(scopedOptions as FindManyOptions);
  }

  public async findOne(options: FindOneOptions<T>): Promise<T> {
    const scopedOptions = {
      ...options,
      where: [
        {
          ...(options?.where || {}),
          scope: Like(`${this.request.scope}%`),
        },
        {
          ...(options?.where || {}),
          program: { enableScope: false },
        },
      ],
    };
    return this.repository.findOne(scopedOptions as FindOneOptions);
  }

  public createQueryBuilder(alias: string): ScopedQueryBuilder<T> {
    const qb = this.repository
      .createQueryBuilder(alias)
      .leftJoin(`${alias}.program`, 'program')
      .andWhere(
        `(program."enableScope" = false OR ${alias}.scope LIKE :scope)`,
        {
          scope: `${this.request.scope}%`,
        },
      );
    return new ScopedQueryBuilder(qb);
  }
}

@Injectable({ scope: Scope.REQUEST, durable: true })
export class RegistrationScopedRepository extends RegistrationScopedBaseRepository<RegistrationEntity> {
  constructor(
    dataSource: DataSource,
    // TODO check if this can be set on ScopedRepository so it can be reused
    @Inject(REQUEST) public request: Request,
  ) {
    super(RegistrationEntity, dataSource);
  }
}

@Injectable({ scope: Scope.REQUEST, durable: true })
export class RegistrationViewScopedRepository extends RegistrationScopedBaseRepository<RegistrationViewEntity> {
  constructor(
    dataSource: DataSource,
    // TODO check if this can be set on ScopedRepository so it can be reused
    @Inject(REQUEST) public request: Request,
  ) {
    super(RegistrationViewEntity, dataSource);
  }
}
