import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaginatorTypes, paginator } from '@nodeteam/nestjs-prisma-pagination';
import { Botlet, Prisma, PrismaClient, Task } from '@prisma/client';
import { Utils } from '../infra/libs/utils';
import { selectHelper } from '../infra/repo/select.helper';
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
    dto: Omit<Prisma.TaskUncheckedCreateInput, 'uuid'>,
    select?: Prisma.TaskSelect,
  ) {
    const prisma = this.txHost.tx as PrismaClient;

    const botlet = await prisma.botlet.findUnique({
      where: {
        uuid: dto.botletUuid,
      },
      select: {
        id: true,
        uuid: true,
      },
    });
    if (!botlet)
      throw new NotFoundException('Botlet not found, uuid=' + dto.botletUuid);

    // quick determine task receiver, may null
    // const receiver = await this.evalTaskReceiver(
    //   prisma,
    //   botlet,
    //   dto.receiverType,
    // );
    // dto.receiverType = receiver?.receiverType;

    // TODO synced call needn't task record
    // if (receiver?.synced) {
    //   const [syncResult] = await this.eventEmitter.emitAsync(
    //     `${TaskCreatedEvent.eventName}.${receiver.receiverType}`,
    //     new TaskCreatedEvent({ ...dto, uuid: undefined }, receiver),
    //   );
    //   return [dto, syncResult];
    // }

    const uuid = Utils.uuid();
    const ret: Task = await selectHelper(
      select,
      (select) =>
        prisma.task.create({
          select,
          data: { ...dto, uuid },
        }),
      this.defSelect,
    );
    ret.uuid = uuid;

    this.eventEmitter.emit(
      TaskCreatedEvent.eventName,
      new TaskCreatedEvent(ret),
    );
    return [ret];
  }

  async evalTaskReceiver(
    prisma: PrismaClient,
    botlet: Partial<Botlet>,
    preferredReceiverType?: string,
  ) {
    // const receiverType =
    //   preferredReceiverType || botlet.receiverType || undefined;
    // TODO: cache synced types for quick check

    const r = 0;
    // await prisma.botletReceiver.findFirst({
    //   where: {
    //     botletUuid: botlet.uuid,
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

  findOne(uuid: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.task.findUnique({
        select,
        where: { uuid },
      }),
    );
  }
}
