import {
  type ApiResponse,
  type ListTransfersQuery,
  listTransfersQuerySchema,
  type MyClubDto,
  myClubDtoSchema,
  type PaginatedResponse,
  type RejectTransferInput,
  rejectTransferSchema,
  type RequestTransfer,
  requestTransferSchema,
  type TransferDto,
  transferDtoSchema,
} from '@efed/shared';
import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { requestContextFrom } from '../../common/http/request-context.js';
import { UuidParamPipe } from '../../common/http/uuid-param.pipe.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import {
  ApiProblems,
  ApiZodBody,
  ApiZodQuery,
  ApiZodResponse,
} from '../../common/openapi/zod-openapi.js';
import { CurrentAuth, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthContext } from '../auth/auth.types.js';
import { TransfersService } from './transfers.service.js';

@ApiTags('Jogador')
@ApiCookieAuth()
@ApiProblems(401, 403)
@RequirePermissions('player_profile.manage')
@Controller({ path: 'me', version: '1' })
export class MyClubController {
  constructor(private readonly transfers: TransfersService) {}

  @Get('club')
  @ApiOperation({ summary: 'Clube atual, histórico de vínculos e pedidos de transferência' })
  @ApiZodResponse(myClubDtoSchema, { description: 'Situação no clube.' })
  async club(@CurrentAuth() auth: AuthContext): Promise<ApiResponse<MyClubDto>> {
    return { data: await this.transfers.myClub(auth) };
  }

  @Post('club/leave')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sai do clube atual (encerra o vínculo hoje)' })
  @ApiZodResponse(myClubDtoSchema, { description: 'Situação atualizada.' })
  @ApiProblems(404, 409)
  async leave(
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ): Promise<ApiResponse<MyClubDto>> {
    return { data: await this.transfers.leave(auth, requestContextFrom(request)) };
  }

  @Post('transfers')
  @ApiOperation({
    summary: 'Pede para entrar em um clube',
    description:
      'Se o clube tem responsável, ele decide primeiro; depois, a federação. Um pedido em aberto por vez.',
  })
  @ApiZodBody(requestTransferSchema)
  @ApiZodResponse(transferDtoSchema, { description: 'Pedido criado.', status: 201 })
  @ApiProblems(400, 404, 409)
  async request(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(requestTransferSchema)) body: RequestTransfer,
    @Req() request: Request,
  ): Promise<ApiResponse<TransferDto>> {
    return { data: await this.transfers.request(auth, body, requestContextFrom(request)) };
  }

  @Post('transfers/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancela o próprio pedido em aberto' })
  @ApiZodResponse(transferDtoSchema, { description: 'Pedido cancelado.' })
  @ApiProblems(404, 409)
  async cancel(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new UuidParamPipe()) id: string,
    @Req() request: Request,
  ): Promise<ApiResponse<TransferDto>> {
    return { data: await this.transfers.cancel(auth, id, requestContextFrom(request)) };
  }
}

/** Pedidos de entrada nos clubes que a conta administra como responsável. */
@ApiTags('Responsável de clube')
@ApiCookieAuth()
@ApiProblems(401, 403)
@Controller({ path: 'me/club-requests', version: '1' })
export class ClubRequestsController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  @ApiOperation({ summary: 'Pedidos aguardando a decisão do responsável' })
  @ApiZodResponse(transferDtoSchema, { description: 'Pedidos.', isArray: true })
  async list(@CurrentAuth() auth: AuthContext): Promise<ApiResponse<TransferDto[]>> {
    return { data: await this.transfers.clubRequests(auth) };
  }

  @Post(':id/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Aceita o jogador (o pedido segue para a federação)' })
  @ApiZodResponse(transferDtoSchema, { description: 'Pedido aceito pelo clube.' })
  @ApiProblems(404, 409)
  async accept(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new UuidParamPipe()) id: string,
    @Req() request: Request,
  ): Promise<ApiResponse<TransferDto>> {
    return {
      data: await this.transfers.clubDecision(
        auth,
        id,
        { accept: true },
        requestContextFrom(request),
      ),
    };
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Recusa o pedido, com motivo' })
  @ApiZodBody(rejectTransferSchema)
  @ApiZodResponse(transferDtoSchema, { description: 'Pedido recusado.' })
  @ApiProblems(400, 404, 409)
  async reject(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(rejectTransferSchema)) body: RejectTransferInput,
    @Req() request: Request,
  ): Promise<ApiResponse<TransferDto>> {
    return {
      data: await this.transfers.clubDecision(
        auth,
        id,
        { accept: false, reason: body.reason },
        requestContextFrom(request),
      ),
    };
  }
}

@ApiTags('Administração — Transferências')
@ApiCookieAuth()
@ApiProblems(401, 403)
@RequirePermissions('transfers.decide')
@Controller({ path: 'admin/transfers', version: '1' })
export class AdminTransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  @ApiOperation({
    summary: 'Pedidos de transferência por situação (padrão: aguardando a federação)',
  })
  @ApiZodQuery(listTransfersQuerySchema)
  @ApiZodResponse(transferDtoSchema, { description: 'Página de pedidos.', paginated: true })
  list(
    @Query(new ZodValidationPipe(listTransfersQuerySchema)) query: ListTransfersQuery,
  ): Promise<PaginatedResponse<TransferDto>> {
    return this.transfers.list(query);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Aprova a transferência',
    description:
      'Encerra o vínculo ativo e cria o novo, na mesma transação. Vínculos passados não mudam.',
  })
  @ApiZodResponse(transferDtoSchema, { description: 'Transferência aprovada.' })
  @ApiProblems(404, 409)
  async approve(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new UuidParamPipe()) id: string,
    @Req() request: Request,
  ): Promise<ApiResponse<TransferDto>> {
    return { data: await this.transfers.approve(auth, id, requestContextFrom(request)) };
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Recusa a transferência, com motivo' })
  @ApiZodBody(rejectTransferSchema)
  @ApiZodResponse(transferDtoSchema, { description: 'Transferência recusada.' })
  @ApiProblems(400, 404, 409)
  async reject(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(rejectTransferSchema)) body: RejectTransferInput,
    @Req() request: Request,
  ): Promise<ApiResponse<TransferDto>> {
    return {
      data: await this.transfers.reject(auth, id, body.reason, requestContextFrom(request)),
    };
  }
}
