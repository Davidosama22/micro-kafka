import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, from, switchMap, throwError, timeout } from 'rxjs';
import { PAYMENTS_SERVICE } from '@app/common/constants/service';
import { CREATE_CHARGE } from '@app/common/constants/patterns';
import type { UserDto } from '@app/common/dto/user.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationRepo } from './reservation.repo';

export const PAYMENT_TIMEOUT_MS = 30_000;

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    private readonly reservationRepo: ReservationRepo,
    @Inject(PAYMENTS_SERVICE) private readonly paymentsService: ClientProxy,
  ) {}

  create(createReservationDto: CreateReservationDto, { email, _id }: UserDto) {
    return this.paymentsService
      .send<{ id: string }>(CREATE_CHARGE, {
        ...createReservationDto.charge,
        email,
      })
      .pipe(
        timeout(PAYMENT_TIMEOUT_MS),
        catchError((err: { message?: string | string[] }) => {
          this.logger.error(
            `Charge failed for ${email}: ${JSON.stringify(err?.message ?? err)}`,
          );
          return throwError(
            () => new BadRequestException(err?.message ?? 'Payment failed'),
          );
        }),
        switchMap((res) => {
          const { startDate, endDate } = createReservationDto;
          return from(
            this.reservationRepo.create({
              startDate,
              endDate,
              invoiceId: res.id,
              timestamp: new Date(),
              userId: _id,
            }),
          );
        }),
      );
  }

  async findAll() {
    return this.reservationRepo.find({});
  }

  async findOne(_id: string) {
    return this.reservationRepo.findOne({ _id });
  }

  async update(_id: string, updateReservationDto: UpdateReservationDto) {
    return this.reservationRepo.findOneAndUpdate(
      { _id },
      { $set: updateReservationDto },
    );
  }

  async remove(_id: string) {
    return this.reservationRepo.findOneAndDelete({ _id });
  }
}
