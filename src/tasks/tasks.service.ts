import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaginatorTypes, paginator } from '@nodeteam/nestjs-prisma-pagination';
import { Callgent, Prisma, PrismaClient, Task } from '@prisma/client';
import { Utils } from '../infra/libs/utils';
import { selectHelper } from '../infra/repo/select.helper';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskCreatedEvent } from './events/task-created.event';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });

@Injectable()
export class TasksService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  protected readonly defSelect: Prisma.TaskSelect = {
    id: false,
    tenantId: false,
    createdBy: false,
    deletedAt: false,
  };

  /**
   * create task to call receiver, maybe progressively.
   *
   * @returns [task, syncResult]
   */
  @Transactional()
  async create(
    dto: CreateTaskDto,
    createdBy: string,
    select?: Prisma.TaskSelect,
  ) {
    const data = dto as Prisma.CallgentUncheckedCreateInput;
    (data.uuid = Utils.uuid()), (data.createdBy = createdBy);

    const prisma = this.txHost.tx as PrismaClient;
    const ret: Task = await selectHelper(
      select,
      (select) => prisma.task.create({ select, data }),
      this.defSelect,
    );

    this.eventEmitter.emit(
      TaskCreatedEvent.eventName,
      new TaskCreatedEvent({ ...data, ...ret }),
    );
    return ret;
  }

  async evalTaskReceiver(
    prisma: PrismaClient,
    callgent: Partial<Callgent>,
    preferredReceiverType?: string,
  ) {
    // const receiverType =
    //   preferredReceiverType || callgent.receiverType || undefined;
    // TODO: cache synced types for quick check

    const r = 0;
    // await prisma.callgentReceiver.findFirst({
    //   where: {
    //     callgentUuid: callgent.uuid,
    //     receiverType,
    //   },
    //   orderBy: {
    //     order: 'asc',
    //   },
    // });

    // invalid receiver specified
    // if (receiverType && !r)
    //   throw new BadRequestException('No receiver found: ' + receiverType);
    return r;
  }

  findAll({
    select,
    where,
    orderBy = { id: 'desc' },
    page,
    perPage,
  }: {
    select?: Prisma.TaskSelect;
    where?: Prisma.TaskWhereInput;
    orderBy?: Prisma.TaskOrderByWithRelationInput;
    page?: number;
    perPage?: number;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      async (select) => {
        const result = paginate(
          prisma.task,
          {
            select,
            where,
            orderBy,
          },
          {
            page,
            perPage,
          },
        );
        return result;
      },
      this.defSelect,
      'data',
    );
  }

  @Transactional()
  delete(uuid: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.task.delete({ select, where: { uuid } }),
    );
  }

  @Transactional()
  update(dto: UpdateTaskDto) {
    if (!dto.uuid) return;
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.task.update({
        select,
        where: { uuid: dto.uuid },
        data: dto,
      }),
    );
  }

  findOne(uuid: string, select?: Prisma.TaskSelect) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) =>
        prisma.task.findUnique({
          select,
          where: { uuid },
        }),
      this.defSelect,
    );
  }
}
