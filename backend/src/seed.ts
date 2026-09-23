import "reflect-metadata";
import bcrypt from "bcryptjs";
import { AppDataSource } from "./config/data-source";
import { DistributorEntity } from "./models/DistributorEntity";
import { OrderEntity, OrderStatus } from "./models/OrderEntity";
import { OrderLineItemEntity } from "./models/OrderLineItemEntity";
import { PointsLedgerEntity } from "./models/PointsLedgerEntity";
import { ProductEntity } from "./models/ProductEntity";
import { SalesManagerEntity } from "./models/SalesManagerEntity";
import { UserEntity, UserRole } from "./models/UserEntity";

const SaltRounds = 10;

const BronzeId = "11111111-1111-1111-1111-111111111111";
const SilverId = "22222222-2222-2222-2222-222222222222";
const GoldId = "33333333-3333-3333-3333-333333333333";
const SalesManagerId = "44444444-4444-4444-4444-444444444444";

async function seed() {
  await AppDataSource.initialize();

  const ProductRepository = AppDataSource.getRepository(ProductEntity);
  const DistributorRepository = AppDataSource.getRepository(DistributorEntity);
  const SalesManagerRepository =
    AppDataSource.getRepository(SalesManagerEntity);
  const OrderRepository = AppDataSource.getRepository(OrderEntity);
  const OrderLineItemRepository =
    AppDataSource.getRepository(OrderLineItemEntity);
  const PointsLedgerRepository =
    AppDataSource.getRepository(PointsLedgerEntity);
  const UserRepository = AppDataSource.getRepository(UserEntity);

  const Products = await ProductRepository.save([
    {
      Sku: "SKU-001",
      Name: "Standard Widget",
      UnitPrice: 25.0,
      StockQuantity: 120,
    },
    {
      Sku: "SKU-002",
      Name: "Premium Widget",
      UnitPrice: 60.0,
      StockQuantity: 45,
    },
    {
      Sku: "SKU-003",
      Name: "Widget Bundle",
      UnitPrice: 150.0,
      StockQuantity: 0,
    },
    { Sku: "SKU-004", Name: "Widget Pro", UnitPrice: 90.0, StockQuantity: 1 },
    { Sku: "SKU-005", Name: "Widget Max", UnitPrice: 500.0, StockQuantity: 15 },
    {
      Sku: "SKU-006",
      Name: "Widget Ultra",
      UnitPrice: 1250.0,
      StockQuantity: 30,
    },
    {
      Sku: "SKU-007",
      Name: "Widget Mini",
      UnitPrice: 12.5,
      StockQuantity: 300,
    },
    { Sku: "SKU-008", Name: "Widget Plus", UnitPrice: 75.0, StockQuantity: 80 },
  ]);

  const WidgetUltra = Products.find((P) => P.Sku === "SKU-006")!;

  const [Bronze, Silver, Gold] = await DistributorRepository.save([
    { Id: BronzeId, Name: "Bronze Traders Ltd", CreditLimit: 5000.0 },
    { Id: SilverId, Name: "Silver Distribution Co", CreditLimit: 20000.0 },
    { Id: GoldId, Name: "Gold Wholesale Group", CreditLimit: 50000.0 },
  ]);

  const SalesManager = await SalesManagerRepository.save({
    Id: SalesManagerId,
    Name: "Jordan Price",
  });

  const [DemoDistributorPasswordHash, DemoManagerPasswordHash] =
    await Promise.all([
      bcrypt.hash("Distributor@123", SaltRounds),
      bcrypt.hash("Manager@123", SaltRounds),
    ]);

  await UserRepository.save([
    {
      Name: "Demo Distributor",
      Email: "distributor.demo@example.com",
      Password: DemoDistributorPasswordHash,
      Role: UserRole.Distributor,
      Distributor: Bronze,
    },
    {
      Name: "Demo Sales Manager",
      Email: "manager.demo@example.com",
      Password: DemoManagerPasswordHash,
      Role: UserRole.SalesManager,
      SalesManager: SalesManager,
    },
  ]);

  const HistoricalOrders = [
    { distributor: Silver, quantity: 40 },
    { distributor: Silver, quantity: 40 },
    { distributor: Silver, quantity: 40 },
    { distributor: Gold, quantity: 150 },
    { distributor: Gold, quantity: 150 },
    { distributor: Gold, quantity: 150 },
  ];

  for (const {
    distributor: Distributor,
    quantity: Quantity,
  } of HistoricalOrders) {
    const Subtotal = WidgetUltra.UnitPrice * Quantity;
    const Total = Subtotal;
    const Points = Math.floor(Total / 100);

    const Order = await OrderRepository.save({
      Distributor: Distributor,
      Status: OrderStatus.Confirmed,
      DiscountPercent: 0,
      Subtotal: Subtotal,
      Total: Total,
      IdempotencyKey: null,
    });

    await OrderLineItemRepository.save({
      Order: Order,
      Product: WidgetUltra,
      Quantity: Quantity,
      UnitPrice: WidgetUltra.UnitPrice,
    });

    await PointsLedgerRepository.save({
      Distributor: Distributor,
      Order: Order,
      Points: Points,
    });
  }

  console.log(
    "Seed complete: 8 products, 3 distributors (Bronze/Silver/Gold), 1 sales manager, 2 demo login accounts, historical points seeded.",
  );
  console.log(
    `Bronze=${BronzeId} Silver=${SilverId} Gold=${GoldId} SalesManager=${SalesManagerId}`,
  );
  console.log(
    "Demo distributor login: distributor.demo@example.com / Distributor@123",
  );
  console.log(
    "Demo sales manager login: manager.demo@example.com / Manager@123",
  );

  await AppDataSource.destroy();
}

seed().catch((Err) => {
  console.error("Seed failed", Err);
  process.exit(1);
});
