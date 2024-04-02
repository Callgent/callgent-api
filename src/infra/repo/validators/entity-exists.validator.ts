import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

export function EntityIdExists(
  entityName: string,
  fieldName = 'id',
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    const objClass = object.constructor;

    // override propertyName to return entity instead of id.
    // const propValues = new WeakMap();
    // Object.defineProperty(objClass.prototype, propertyName, {
    //   get: function () {
    //     return (
    //       this[EntityIdExistsRule.ENTITY_PREFIX + propertyName] ||
    //       propValues[this]
    //     );
    //   },
    //   set: function (v) {
    //     propValues[this] = v;
    //   },
    // });
    registerDecorator({
      name: 'EntityIdExists',
      target: objClass,
      propertyName: propertyName,
      constraints: [entityName, fieldName],
      options: validationOptions,
      validator: EntityIdExistsRule,
    });
  };
}

/** minor optimize to reuse the previously checked entity object. */
EntityIdExists.entity = <T>(dto: any, propertyName: string): T => {
  return dto[ENTITY_PREFIX + propertyName];
};

const ENTITY_PREFIX = '$entityOf_';

/**
 * check entity only one existence by `id`.
 */
@Injectable()
@ValidatorConstraint({ name: 'EntityIdExists', async: true })
export class EntityIdExistsRule implements ValidatorConstraintInterface {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  @Transactional()
  async validate(value: string, args: ValidationArguments) {
    if (!value) return true; // empty no validation
    const [entityName, fieldName = 'id'] = args.constraints;
    try {
      const prisma = this.txHost.tx as PrismaClient;

      const entity = await (prisma[entityName] as any).findUnique({
        where: { [fieldName]: value },
      });

      const entityField = ENTITY_PREFIX + args.property;
      // store entity for reuse
      if (entity && args.object && !args.object[entityField]) {
        Object.defineProperty(args.object, entityField, {
          value: entity,
          enumerable: false, // 不可枚举, json出不来
          configurable: true,
        });
      }

      return !!entity;
    } catch (e) {
      console.error(e, entityName, fieldName, value);
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} entity not found`;
  }
}
