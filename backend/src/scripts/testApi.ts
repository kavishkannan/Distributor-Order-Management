import "reflect-metadata";
import axios, { AxiosResponse } from "axios";
import jwt from "jsonwebtoken";
import { Server } from "http";
import { In } from "typeorm";

const Port = 4199;
process.env.ERP_ENDPOINT_URL = `http://localhost:${Port}/mockerp`;

const Base = `http://localhost:${Port}/api`;
const Http = axios.create({ validateStatus: () => true });

let Passed = 0;
let Failed = 0;

function check(
  Condition: boolean,
  Description: string,
  Detail?: unknown,
): void {
  if (Condition) {
    Passed += 1;
    console.log(`  PASS: ${Description}`);
  } else {
    Failed += 1;
    console.error(
      `  FAIL: ${Description}`,
      Detail === undefined ? "" : JSON.stringify(Detail),
    );
  }
}

function auth(Token: string, Headers: Record<string, string> = {}) {
  return { headers: { Authorization: `Bearer ${Token}`, ...Headers } };
}

const ManagerCredentials = {
  email: "manager.demo@example.com",
  password: "Manager@123",
};

async function main(): Promise<void> {
  const { App } = await import("../app");
  const { AppDataSource } = await import("../config/data-source");
  const { env } = await import("../config/env");
  const { DistributorEntity } = await import("../models/DistributorEntity");
  const { OrderEntity, OrderStatus } = await import("../models/OrderEntity");
  const { OrderEventEntity } = await import("../models/OrderEventEntity");
  const { OutboundEventEntity } = await import("../models/OutboundEventEntity");
  const { PointsLedgerEntity } = await import("../models/PointsLedgerEntity");
  const { ProductEntity } = await import("../models/ProductEntity");
  const { RevokedTokenEntity } = await import("../models/RevokedTokenEntity");
  const { UserEntity } = await import("../models/UserEntity");

  await AppDataSource.initialize();
  const HttpServer: Server = await new Promise((Resolve) => {
    const S = App.listen(Port, () => Resolve(S));
  });

  const DistributorRepo = AppDataSource.getRepository(DistributorEntity);
  const ProductRepo = AppDataSource.getRepository(ProductEntity);
  const OrderRepo = AppDataSource.getRepository(OrderEntity);
  const LedgerRepo = AppDataSource.getRepository(PointsLedgerEntity);
  const OrderEventRepo = AppDataSource.getRepository(OrderEventEntity);
  const OutboundRepo = AppDataSource.getRepository(OutboundEventEntity);

  const Suffix = Date.now().toString(36);
  const Password = "ApiTest123";
  const Emails = [
    `api.a.${Suffix}@example.com`,
    `api.b.${Suffix}@example.com`,
    `api.s.${Suffix}@example.com`,
  ];
  const CreatedOrderIds: string[] = [];
  const ManagerTokens: string[] = [];

  const [DistA, DistB, DistS] = await DistributorRepo.save([
    DistributorRepo.create({ Name: `API A ${Suffix}`, CreditLimit: 1000 }),
    DistributorRepo.create({ Name: `API B ${Suffix}`, CreditLimit: 1000 }),
    DistributorRepo.create({ Name: `API S ${Suffix}`, CreditLimit: 20000 }),
  ]);
  const [Widget, Empty, Last, Big, B6Product] = await ProductRepo.save([
    ProductRepo.create({
      Sku: `API-${Suffix}-W`,
      Name: `API Widget ${Suffix}`,
      UnitPrice: 100,
      StockQuantity: 20,
    }),
    ProductRepo.create({
      Sku: `API-${Suffix}-E`,
      Name: `API Empty ${Suffix}`,
      UnitPrice: 50,
      StockQuantity: 0,
    }),
    ProductRepo.create({
      Sku: `API-${Suffix}-L`,
      Name: `API Last ${Suffix}`,
      UnitPrice: 10,
      StockQuantity: 1,
    }),
    ProductRepo.create({
      Sku: `API-${Suffix}-B`,
      Name: `API Big ${Suffix}`,
      UnitPrice: 1000,
      StockQuantity: 10,
    }),
    ProductRepo.create({
      Sku: `API-${Suffix}-6`,
      Name: `API B6 ${Suffix}`,
      UnitPrice: 1250,
      StockQuantity: 30,
    }),
  ]);
  const History = await OrderRepo.save(
    OrderRepo.create({
      Distributor: DistS,
      Status: OrderStatus.Delivered,
      DiscountPercent: 0,
      Subtotal: 490000,
      Total: 490000,
    }),
  );
  CreatedOrderIds.push(History.Id);
  await LedgerRepo.save(
    LedgerRepo.create({ Distributor: DistS, Order: History, Points: 4900 }),
  );

  const stockOf = async (Id: string) =>
    (await ProductRepo.findOneByOrFail({ Id })).StockQuantity;
  const netPointsOf = async (OrderId: string) =>
    (await LedgerRepo.find({ where: { Order: { Id: OrderId } } })).reduce(
      (Sum, Row) => Sum + Row.Points,
      0,
    );
  const eventsOf = (OrderId: string) =>
    OrderEventRepo.find({ where: { Order: { Id: OrderId } } });
  const outboundOf = (OrderId: string) =>
    OutboundRepo.find({ where: { Order: { Id: OrderId } } });

  try {
    console.log("\n[1] Authentication and logout");
    const Signups: AxiosResponse[] = [];
    for (const [Email, Dist] of [
      [Emails[0], DistA],
      [Emails[1], DistB],
      [Emails[2], DistS],
    ] as const) {
      Signups.push(
        await Http.post(`${Base}/auth/signup`, {
          name: "API Test",
          email: Email,
          password: Password,
          role: "DISTRIBUTOR",
          distributorId: Dist.Id,
        }),
      );
    }
    check(
      Signups.every(
        (R) => R.status === 201 && typeof R.data.token === "string",
      ),
      "signup -> 201 with token",
    );
    check(
      Signups.every(
        (R) =>
          !("password" in R.data.user) &&
          !JSON.stringify(R.data).includes("$2"),
      ),
      "no password or hash in the signup response",
    );
    const TokenA: string = Signups[0].data.token;
    const TokenB: string = Signups[1].data.token;
    const TokenS: string = Signups[2].data.token;
    const Stored = await AppDataSource.getRepository(
      UserEntity,
    ).findOneByOrFail({ Email: Emails[0] });
    check(
      Stored.Password.startsWith("$2") && Stored.Password !== Password,
      "password stored as a bcrypt hash",
    );

    const BadLogin = await Http.post(`${Base}/auth/signin`, {
      email: Emails[0],
      password: "Wrong12345",
    });
    const UnknownLogin = await Http.post(`${Base}/auth/signin`, {
      email: `nobody.${Suffix}@example.com`,
      password: "Wrong12345",
    });
    check(
      BadLogin.status === 401 &&
        UnknownLogin.status === 401 &&
        BadLogin.data.message === UnknownLogin.data.message,
      "wrong password and unknown email -> identical 401",
    );
    check(
      (await Http.get(`${Base}/auth/me`)).status === 401,
      "no token -> 401",
    );
    const Expired = jwt.sign(
      { sub: Stored.Id, role: "DISTRIBUTOR" },
      env.jwtSecret,
      { expiresIn: -10 },
    );
    check(
      (await Http.get(`${Base}/auth/me`, auth(Expired))).status === 401,
      "expired token -> 401",
    );
    const Forged = jwt.sign(
      { sub: Stored.Id, role: "SALES_MANAGER" },
      "wrong-secret",
      { expiresIn: "1h" },
    );
    check(
      (await Http.get(`${Base}/auth/me`, auth(Forged))).status === 401,
      "token with a wrong signature -> 401",
    );

    const Session = (
      await Http.post(`${Base}/auth/signin`, {
        email: Emails[0],
        password: Password,
      })
    ).data.token as string;
    check(
      (await Http.get(`${Base}/auth/me`, auth(Session))).status === 200,
      "signin token works",
    );
    const Logout = await Http.post(
      `${Base}/auth/logout`,
      undefined,
      auth(Session),
    );
    check(
      Logout.status === 200 && Logout.data.token === undefined,
      "logout -> 200, no token in response",
    );
    check(
      (await Http.get(`${Base}/auth/me`, auth(Session))).status === 401,
      "logged-out token -> 401",
    );
    check(
      (await Http.get(`${Base}/auth/me`, auth(TokenA))).status === 200,
      "the user's other session is unaffected",
    );

    const Manager = await Http.post(`${Base}/auth/signin`, ManagerCredentials);
    check(Manager.status === 200, "manager signin");
    const TokenM: string = Manager.data.token;
    ManagerTokens.push(TokenM);

    console.log("\n[2] Authorization");
    check(
      (await Http.get(`${Base}/salesmanager/getpendingapprovals`, auth(TokenA)))
        .status === 403,
      "distributor -> manager queue 403",
    );
    check(
      (
        await Http.post(
          `${Base}/order/approveorder/${History.Id}`,
          {},
          auth(TokenA),
        )
      ).status === 403,
      "distributor -> approve 403",
    );
    check(
      (
        await Http.post(
          `${Base}/order/placeorder`,
          { lineItems: [{ productId: Widget.Id, quantity: 1 }] },
          auth(TokenM),
        )
      ).status === 403,
      "manager -> place order 403",
    );
    check(
      (
        await Http.get(
          `${Base}/distributor/getdashboard/${DistB.Id}`,
          auth(TokenA),
        )
      ).status === 403,
      "distributor -> another distributor's dashboard 403",
    );
    check(
      (
        await Http.get(
          `${Base}/distributor/getdistributorbyid/${DistB.Id}`,
          auth(TokenA),
        )
      ).status === 403,
      "distributor -> another distributor's profile 403",
    );
    check(
      (
        await Http.get(
          `${Base}/distributor/getdistributorbyid/${DistA.Id}`,
          auth(TokenA),
        )
      ).status === 200,
      "distributor -> own profile 200",
    );
    check(
      (
        await Http.get(
          `${Base}/distributor/getdistributorbyid/${DistB.Id}`,
          auth(TokenM),
        )
      ).status === 200,
      "manager -> any distributor profile 200",
    );

    console.log("\n[3] Validation and error shape");
    const BadId = await Http.get(
      `${Base}/salesmanager/getorderbyid/not-a-uuid`,
      auth(TokenM),
    );
    check(
      BadId.status === 400 &&
        BadId.data.message === "Validation failed" &&
        Array.isArray(BadId.data.errors),
      "invalid id -> 400 validation envelope",
    );
    const Missing = await Http.get(
      `${Base}/salesmanager/getorderbyid/00000000-0000-4000-8000-000000000000`,
      auth(TokenM),
    );
    check(
      Missing.status === 404 && typeof Missing.data.message === "string",
      "unknown order -> 404 JSON",
    );
    const BadJson = await Http.post(
      `${Base}/order/placeorder`,
      "{oops",
      auth(TokenA, { "Content-Type": "application/json" }),
    );
    check(
      BadJson.status === 400 &&
        BadJson.data.message === "Malformed JSON in request body",
      "malformed JSON -> 400",
    );
    const NoRoute = await Http.get(`${Base}/does-not-exist`);
    check(
      NoRoute.status === 404 && NoRoute.data.message === "Route not found",
      "unknown route -> 404 JSON",
      NoRoute.data,
    );
    const BadLines = await Http.post(
      `${Base}/order/placeorder`,
      {
        lineItems: [
          { productId: Widget.Id, quantity: 0 },
          { productId: "x", quantity: 1.5 },
        ],
      },
      auth(TokenA),
    );
    check(
      BadLines.status === 400 && BadLines.data.errors.length >= 3,
      "invalid line items -> 400 listing every issue",
      BadLines.data,
    );
    const BadSort = await Http.get(
      `${Base}/product/getallproducts?sortBy=password`,
      auth(TokenA),
    );
    check(BadSort.status === 400, "non-whitelisted sort field -> 400");
    const Injection = await Http.get(
      `${Base}/product/getallproducts?search=${encodeURIComponent("' OR 1=1 --")}`,
      auth(TokenA),
    );
    check(
      Injection.status === 200 && Injection.data.pagination.total === 0,
      "SQL-ish search text is treated as data",
    );
    check(
      !JSON.stringify([BadId.data, Missing.data, BadJson.data]).includes(
        "stack",
      ),
      "no stack traces in error responses",
    );

    console.log("\n[4] Catalogue (Q1, R7)");
    const Catalogue = await Http.get(
      `${Base}/product/getallproducts?search=API-${Suffix}&sortBy=sku&sortOrder=asc&limit=2`,
      auth(TokenA),
    );
    check(
      Catalogue.status === 200 &&
        Catalogue.data.pagination.total === 5 &&
        Catalogue.data.data.length === 2 &&
        Catalogue.data.pagination.hasNextPage === true,
      "DB-level search + pagination",
    );
    const AllMine = await Http.get(
      `${Base}/product/getallproducts?search=API-${Suffix}`,
      auth(TokenA),
    );
    const EmptyRow = AllMine.data.data.find(
      (P: { Id: string }) => P.Id === Empty.Id,
    );
    check(
      !!EmptyRow &&
        EmptyRow.StockQuantity === 0 &&
        ["Sku", "Name", "UnitPrice", "StockQuantity"].every(
          (K) => K in EmptyRow,
        ),
      "zero-stock product listed with SKU, name, price, stock",
    );
    const OutOfStock = await Http.post(
      `${Base}/order/placeorder`,
      { lineItems: [{ productId: Empty.Id, quantity: 1 }] },
      auth(TokenA),
    );
    check(
      OutOfStock.status === 409 &&
        OutOfStock.data.sku === Empty.Sku &&
        OutOfStock.data.availableQuantity === 0,
      "zero-stock order refused by the API with SKU + available quantity",
    );

    console.log("\n[5] Placement, stock and credit (Q2, Q3, Q8, R1, R3)");
    const WidgetStock0 = await stockOf(Widget.Id);
    const Short = await Http.post(
      `${Base}/order/placeorder`,
      {
        lineItems: [
          { productId: Widget.Id, quantity: 1 },
          { productId: Big.Id, quantity: 11 },
        ],
      },
      auth(TokenA),
    );
    check(
      Short.status === 409 &&
        Short.data.sku === Big.Sku &&
        Short.data.availableQuantity === 10,
      "insufficient stock -> 409 naming SKU and available quantity",
    );
    check(
      (await stockOf(Widget.Id)) === WidgetStock0,
      "rejected multi-line order reserved nothing (rollback)",
    );

    const Confirmed = await Http.post(
      `${Base}/order/placeorder`,
      {
        lineItems: [
          { productId: Widget.Id, quantity: 3 },
          { productId: Widget.Id, quantity: 2 },
        ],
      },
      auth(TokenA),
    );
    CreatedOrderIds.push(Confirmed.data.Id);
    check(
      Confirmed.status === 201 &&
        Confirmed.data.Status === "Confirmed" &&
        Number(Confirmed.data.Total) === 500,
      "within credit -> 201 Confirmed, total 500",
      Confirmed.data,
    );
    check(
      (await stockOf(Widget.Id)) === WidgetStock0 - 5,
      "stock reserved at placement",
    );
    check(
      (await netPointsOf(Confirmed.data.Id)) === 5,
      "5 points on Confirmed (floor(500/100))",
    );
    const Profile1 = await Http.get(
      `${Base}/distributor/getdistributorbyid/${DistA.Id}`,
      auth(TokenA),
    );
    check(
      Profile1.data.availableCredit === 500,
      "open Confirmed order consumes credit (1000 - 500)",
      Profile1.data,
    );

    const Pending = await Http.post(
      `${Base}/order/placeorder`,
      { lineItems: [{ productId: Big.Id, quantity: 1 }] },
      auth(TokenA),
    );
    CreatedOrderIds.push(Pending.data.Id);
    check(
      Pending.status === 201 && Pending.data.Status === "PendingApproval",
      "total above available credit -> PendingApproval",
    );
    check(
      (await netPointsOf(Pending.data.Id)) === 0,
      "no points while PendingApproval (R4)",
    );
    const Queue = await Http.get(
      `${Base}/salesmanager/getpendingapprovals?search=${Pending.data.Id}`,
      auth(TokenM),
    );
    check(
      Queue.data.data.length === 1 && Queue.data.data[0].Id === Pending.data.Id,
      "appears in the sales manager queue",
    );
    const Forced = await Http.post(
      `${Base}/order/placeorder`,
      {
        lineItems: [{ productId: Widget.Id, quantity: 1 }],
        distributorId: DistB.Id,
        status: "Confirmed",
        total: 0,
      },
      auth(TokenA),
    );
    CreatedOrderIds.push(Forced.data.Id);
    check(
      Forced.status === 201 &&
        Forced.data.Distributor.Id === DistA.Id &&
        Number(Forced.data.Total) === 100 &&
        Forced.data.Status === "PendingApproval",
      "client-sent distributorId/status/total ignored; credit computed server-side",
      Forced.data,
    );

    console.log("\n[6] State machine (Q7)");
    const Actions: Record<string, string> = {
      Confirmed: "approveorder",
      Rejected: "rejectorder",
      Cancelled: "cancelorder",
      Dispatched: "dispatchorder",
      Delivered: "deliverorder",
    };
    const tryAction = (OrderId: string, Action: string, Key?: string) =>
      Http.post(
        `${Base}/salesmanager/${Action}/${OrderId}`,
        {},
        auth(TokenM, Key ? { "Idempotency-Key": Key } : {}),
      );
    for (const Action of ["approveorder", "rejectorder", "deliverorder"]) {
      const R = await tryAction(Confirmed.data.Id, Action);
      check(
        R.status === 409 && R.data.fromStatus === "Confirmed",
        `Confirmed -> ${Action}: 409`,
        R.data,
      );
    }
    for (const Action of ["dispatchorder", "deliverorder"]) {
      const R = await tryAction(Pending.data.Id, Action);
      check(
        R.status === 409 && R.data.fromStatus === "PendingApproval",
        `PendingApproval -> ${Action}: 409`,
      );
    }
    const Unchanged = await OrderRepo.findOneByOrFail({
      Id: Confirmed.data.Id,
    });
    check(
      Unchanged.Status === OrderStatus.Confirmed &&
        (await eventsOf(Confirmed.data.Id)).length === 2,
      "failed transitions left status and history unchanged",
    );

    console.log(
      "\n[7] Approve / dispatch / deliver with retried requests (Q8, Q12)",
    );
    const ApproveKey = `api-approve-${Suffix}`;
    const Approve1 = await tryAction(
      Pending.data.Id,
      "approveorder",
      ApproveKey,
    );
    const Approve2 = await tryAction(
      Pending.data.Id,
      "approveorder",
      ApproveKey,
    );
    check(
      Approve1.status === 200 &&
        Approve2.status === 200 &&
        Approve2.data.Status === "Confirmed",
      "approve + retry with the same key -> both 200",
    );
    check(
      (await netPointsOf(Pending.data.Id)) === 10,
      "approval awarded 10 points exactly once",
    );
    const ApproveAgain = await tryAction(Pending.data.Id, "approveorder");
    check(ApproveAgain.status === 409, "a new approve request (no key) -> 409");
    const KeyReuse = await tryAction(
      Pending.data.Id,
      "dispatchorder",
      ApproveKey,
    );
    check(
      KeyReuse.status === 422,
      "same key reused for a different action -> 422",
    );
    const BigStockBeforeDispatch = await stockOf(Big.Id);
    const DispatchKey = `api-dispatch-${Suffix}`;
    const D1 = await tryAction(Pending.data.Id, "dispatchorder", DispatchKey);
    const D2 = await tryAction(Pending.data.Id, "dispatchorder", DispatchKey);
    check(
      D1.data.Status === "Dispatched" && D2.status === 200,
      "dispatch + retry -> Dispatched once",
    );
    const CancelDispatched = await tryAction(Pending.data.Id, "cancelorder");
    check(
      CancelDispatched.status === 409 &&
        (await stockOf(Big.Id)) === BigStockBeforeDispatch,
      "cannot cancel after Dispatched; stock stays deducted",
    );
    const DeliverKey = `api-deliver-${Suffix}`;
    const Del1 = await tryAction(Pending.data.Id, "deliverorder", DeliverKey);
    const Del2 = await tryAction(Pending.data.Id, "deliverorder", DeliverKey);
    check(
      Del1.data.Status === "Delivered" && Del2.status === 200,
      "deliver + retry -> Delivered once",
    );
    const Transitions = (await eventsOf(Pending.data.Id)).map(
      (E) => E.ToStatus,
    );
    check(
      Transitions.length === 5 &&
        Transitions.filter((S) => S === "Dispatched").length === 1,
      "history has each change exactly once",
      Transitions,
    );
    const Profile2 = await Http.get(
      `${Base}/distributor/getdistributorbyid/${DistA.Id}`,
      auth(TokenA),
    );
    check(
      Profile2.data.availableCredit === 400,
      "Delivered order no longer consumes credit (1000 - 500 - 100)",
      Profile2.data,
    );

    console.log("\n[8] Reject and cancel release stock exactly once (Q9)");
    const ToReject = await Http.post(
      `${Base}/order/placeorder`,
      { lineItems: [{ productId: Big.Id, quantity: 2 }] },
      auth(TokenA),
    );
    CreatedOrderIds.push(ToReject.data.Id);
    const BigBeforeReject = await stockOf(Big.Id);
    const RejectKey = `api-reject-${Suffix}`;
    const R1 = await tryAction(ToReject.data.Id, "rejectorder", RejectKey);
    const R2 = await tryAction(ToReject.data.Id, "rejectorder", RejectKey);
    check(
      R1.data.Status === "Rejected" &&
        R2.status === 200 &&
        (await stockOf(Big.Id)) === BigBeforeReject + 2,
      "reject + retry releases stock once",
    );
    check(
      (await tryAction(ToReject.data.Id, "cancelorder")).status === 409,
      "Rejected -> Cancelled: 409",
    );

    const WidgetBeforeCancel = await stockOf(Widget.Id);
    const CancelKey = `api-cancel-${Suffix}`;
    const cancelOwn = (Key: string) =>
      Http.post(
        `${Base}/distributor/cancelorder/${DistA.Id}/${Confirmed.data.Id}`,
        {},
        auth(TokenA, { "Idempotency-Key": Key }),
      );
    const C1 = await cancelOwn(CancelKey);
    const C2 = await cancelOwn(CancelKey);
    check(
      C1.data.Status === "Cancelled" && C2.status === 200,
      "distributor cancels own Confirmed order (+ retry)",
    );
    check(
      (await stockOf(Widget.Id)) === WidgetBeforeCancel + 5,
      "stock released exactly once",
    );
    check(
      (await netPointsOf(Confirmed.data.Id)) === 0,
      "its 5 points reversed exactly once",
    );
    const Foreign = await Http.post(
      `${Base}/order/cancelorder/${Forced.data.Id}`,
      {},
      auth(TokenB),
    );
    check(Foreign.status === 404, "another distributor cannot cancel it (404)");
    const OwnDetail = await Http.get(
      `${Base}/distributor/getorderbyid/${DistB.Id}/${Forced.data.Id}`,
      auth(TokenB),
    );
    check(
      OwnDetail.status === 404,
      "nor read it through their own scope (404)",
    );

    console.log("\n[9] Loyalty: B6 worked example, tier change (Q5, Q10, R2)");
    const Before = await Http.get(
      `${Base}/distributor/getloyaltybyid/${DistS.Id}`,
      auth(TokenS),
    );
    check(
      Before.data.pointsBalance === 4900 &&
        Before.data.tier === "Silver" &&
        Before.data.currentDiscount === 3,
      "4,900 points -> Silver, 3%",
      Before.data,
    );
    const B6 = await Http.post(
      `${Base}/order/placeorder`,
      { lineItems: [{ productId: B6Product.Id, quantity: 10 }] },
      auth(TokenS),
    );
    CreatedOrderIds.push(B6.data.Id);
    check(
      Number(B6.data.Subtotal) === 12500 &&
        Number(B6.data.DiscountPercent) === 3 &&
        Number(B6.data.Total) === 12125 &&
        B6.data.Status === "Confirmed",
      "10 x 1,250: subtotal 12,500, 3% off, total 12,125, Confirmed",
      B6.data,
    );
    check((await netPointsOf(B6.data.Id)) === 121, "121 points awarded");
    const After = await Http.get(
      `${Base}/distributor/getloyaltybyid/${DistS.Id}`,
      auth(TokenS),
    );
    check(
      After.data.pointsBalance === 5021 &&
        After.data.tier === "Gold" &&
        After.data.currentDiscount === 6,
      "balance 5,021 -> Gold, 6%",
      After.data,
    );
    const Next = await Http.post(
      `${Base}/order/placeorder`,
      { lineItems: [{ productId: B6Product.Id, quantity: 1 }] },
      auth(TokenS),
    );
    CreatedOrderIds.push(Next.data.Id);
    check(
      Number(Next.data.DiscountPercent) === 6 &&
        Number(Next.data.Total) === 1175,
      "next order gets 6%",
    );
    const B6Stored = await OrderRepo.findOneByOrFail({ Id: B6.data.Id });
    check(
      Number(B6Stored.DiscountPercent) === 3,
      "earlier order keeps its 3% (R2)",
    );
    const CancelB6 = await Http.post(
      `${Base}/distributor/cancelorder/${DistS.Id}/${B6.data.Id}`,
      {},
      auth(TokenS),
    );
    const Reverted = await Http.get(
      `${Base}/distributor/getloyaltybyid/${DistS.Id}`,
      auth(TokenS),
    );
    check(
      CancelB6.data.Status === "Cancelled" &&
        Reverted.data.pointsBalance === 4911 &&
        Reverted.data.tier === "Silver",
      "cancel reverses 121 points -> back to Silver",
      Reverted.data,
    );

    console.log("\n[10] Concurrency: last unit (Q13)");
    const Race = await Promise.all(
      [TokenA, TokenB].map((Token) =>
        Http.post(
          `${Base}/order/placeorder`,
          { lineItems: [{ productId: Last.Id, quantity: 1 }] },
          auth(Token),
        ),
      ),
    );
    for (const R of Race) if (R.status === 201) CreatedOrderIds.push(R.data.Id);
    const Codes = Race.map((R) => R.status).sort();
    check(
      Codes[0] === 201 && Codes[1] === 409 && (await stockOf(Last.Id)) === 0,
      "exactly one 201 and one 409; stock 0",
      Codes,
    );

    console.log("\n[11] Placement idempotency (Q12)");
    const PlaceKey = `api-place-${Suffix}`;
    const Twice = await Promise.all(
      [1, 2].map(() =>
        Http.post(
          `${Base}/order/placeorder`,
          { lineItems: [{ productId: Widget.Id, quantity: 1 }] },
          auth(TokenB, { "Idempotency-Key": PlaceKey }),
        ),
      ),
    );
    CreatedOrderIds.push(Twice[0].data.Id);
    check(
      Twice.every((R) => R.status === 201) &&
        Twice[0].data.Id === Twice[1].data.Id,
      "two concurrent identical requests -> one order",
    );
    check(
      (await OrderRepo.countBy({ IdempotencyKey: PlaceKey })) === 1,
      "exactly one row stored for the key",
    );
    const OtherUser = await Http.post(
      `${Base}/order/placeorder`,
      { lineItems: [{ productId: Widget.Id, quantity: 1 }] },
      auth(TokenA, { "Idempotency-Key": PlaceKey }),
    );
    check(
      OtherUser.status === 422,
      "same key from another distributor -> 422, not their order",
    );

    console.log("\n[12] History and ERP events (Q11, Q14, R8)");
    const Detail = await Http.get(
      `${Base}/salesmanager/getorderbyid/${Pending.data.Id}`,
      auth(TokenM),
    );
    const Events: {
      ToStatus: string;
      FromStatus: string | null;
      ActorType: string;
      ActorId: string | null;
      CreatedAt: string;
    }[] = Detail.data.Events;
    check(
      Events.map((E) => E.ToStatus).join(">") ===
        "Placed>PendingApproval>Confirmed>Dispatched>Delivered",
      "history in chronological order",
      Events.map((E) => E.ToStatus),
    );
    check(
      Events[0].ActorType === "Distributor" &&
        Events[1].ActorType === "System" &&
        Events.slice(2).every(
          (E) =>
            E.ActorType === "SalesManager" &&
            E.ActorId === Manager.data.user.salesManagerId,
        ),
      "actor recorded for every change",
    );
    check(
      Events.every(
        (E, I) =>
          !!E.CreatedAt && (I === 0 || E.FromStatus === Events[I - 1].ToStatus),
      ),
      "timestamps present; each event continues from the previous status",
    );
    let UpdateBlocked = false;
    try {
      await AppDataSource.query(
        "UPDATE order_events SET toStatus = 'Cancelled' WHERE order_id = ?",
        [Pending.data.Id],
      );
    } catch {
      UpdateBlocked = true;
    }
    check(UpdateBlocked, "database rejects rewriting history (append-only)");
    await new Promise((Resolve) => setTimeout(Resolve, 300));
    const Outbound = await outboundOf(Pending.data.Id);
    const Payloads = Outbound.map((O) => O.Payload as Record<string, unknown>);
    check(
      Outbound.length === 5 &&
        Outbound.every((O) => O.Status === "Sent" && O.AttemptCount === 1),
      "one ERP event per status change, each delivered once",
      Outbound.map((O) => [O.Status, O.AttemptCount]),
    );
    check(
      Payloads.every((P) =>
        [
          "orderId",
          "orderEventId",
          "previousStatus",
          "newStatus",
          "actorType",
          "actorId",
          "total",
          "timestamp",
        ].every((K) => K in P),
      ),
      "ERP payload carries order, previous/new status, actor and timestamp",
    );
    const Replays = await outboundOf(ToReject.data.Id);
    check(
      Replays.length === 3,
      "retried requests created no extra ERP events (Placed, PendingApproval, Rejected)",
      Replays.length,
    );
  } finally {
    HttpServer.close();
    if (CreatedOrderIds.length > 0) {
      await LedgerRepo.delete({ Order: { Id: In(CreatedOrderIds) } });
      await OutboundRepo.delete({ Order: { Id: In(CreatedOrderIds) } });
      await OrderRepo.delete({ Id: In(CreatedOrderIds) });
    }
    await AppDataSource.getRepository(UserEntity).delete({ Email: In(Emails) });
    const { createHash } = await import("crypto");
    for (const Token of ManagerTokens) {
      await AppDataSource.getRepository(RevokedTokenEntity).delete({
        TokenHash: createHash("sha256").update(Token).digest("hex"),
      });
    }
    await ProductRepo.delete({
      Id: In([Widget.Id, Empty.Id, Last.Id, Big.Id, B6Product.Id]),
    });
    await DistributorRepo.delete({ Id: In([DistA.Id, DistB.Id, DistS.Id]) });
    await AppDataSource.destroy();
  }

  console.log(`\n${Passed} passed, ${Failed} failed`);
  process.exit(Failed > 0 ? 1 : 0);
}

main().catch((Err) => {
  console.error(Err);
  process.exit(1);
});
