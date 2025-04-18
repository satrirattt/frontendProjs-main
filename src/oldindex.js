require("dotenv").config();
const express = require("express");
const path = require('path');
const session = require('express-session');
const cors = require("cors");
const { Sequelize, DataTypes } = require("sequelize");
const app = express();
app.use(cors()); // ใช้ CORS
app.use(express.json());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));  // ให้ Express ใช้โฟลเดอร์ public สำหรับไฟล์ static
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, '..', 'ProjectFrontEnd', 'views')); // ปรับที่นี่ให้ชี้ไปที่โฟลเดอร์ views
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./Database/app.sqlite",
});

// Define Models
const Customer = sequelize.define("Customer", {
  Customer_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Customer_Name: DataTypes.STRING,
  Customer_address: DataTypes.STRING,
  Customer_Phonenumber: DataTypes.STRING,
});

const Product = sequelize.define("Product", {
  Product_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Product_Name: DataTypes.STRING,
  Product_Price: DataTypes.INTEGER,
  Product_Description: DataTypes.STRING,
  Product_image: DataTypes.STRING, // สำหรับชื่อไฟล์รูปภาพ
});

const Employees = sequelize.define("Employees", {
  Employees_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Employees_Name: DataTypes.STRING,
  Employees_Position: DataTypes.STRING,
  Employees_Phonenumber: DataTypes.STRING,
});

const Order = sequelize.define("Order", {
  Order_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Order_Datetime: DataTypes.DATE,
  Order_Total_Price: DataTypes.INTEGER,
  Order_Customer_ID: DataTypes.INTEGER,
});

const OrderDetail = sequelize.define("OrderDetail", {
  OrderDetail_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  OrderDetail_Quantity: DataTypes.INTEGER,
  OrderDetail_Price_Unit: DataTypes.INTEGER,
  OrderDetail_Total_Price: DataTypes.INTEGER,
});

const Promotion = sequelize.define("Promotion", {
  Promotion_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Promotion_Name: DataTypes.STRING,
  Promotion_Discount: DataTypes.INTEGER,
  Promotion_Start_Date: DataTypes.DATE,
  Promotion_end_Date: DataTypes.DATE,
  Promotion_Description: DataTypes.STRING,
});

const Payment = sequelize.define("Payment", {
  Payment_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Payment_Type: DataTypes.STRING,
  Payment_Amount: DataTypes.INTEGER,
  Payment_Date: DataTypes.DATE,
  Payment_Status: DataTypes.STRING,
});

const Delivery = sequelize.define("Delivery", {
  Delivery_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Delivery_Status: DataTypes.STRING,
  Delivery_date: DataTypes.DATE,
});

Order.hasMany(OrderDetail, { foreignKey: "OrderDetail_Order_ID" });
Order.belongsTo(Customer, { foreignKey: "Order_Customer_ID" });
OrderDetail.belongsTo(Order, { foreignKey: "OrderDetail_Order_ID" });
OrderDetail.belongsTo(Product, { foreignKey: "OrderDetail_Product_ID" });
Payment.belongsTo(Order, { foreignKey: "Payment_Order_ID" });
Payment.belongsTo(Promotion, { foreignKey: "Payment_Promotion_ID" });
Delivery.belongsTo(Order, { foreignKey: "Delivery_Order_ID" });
Delivery.belongsTo(Employees, { foreignKey: "Delivery_Employees_ID" });

// ส่งออกโมเดลที่ต้องการใช้งานในไฟล์อื่น (ถ้ามี)
module.exports = { Product, Customer, Order, OrderDetail };

sequelize.authenticate()
    .then(() => {
        console.log('Connection has been established successfully.');
    })
    .catch(err => {
        console.error('Unable to connect to the database:', err);
    });

sequelize.sync();

// หน้าหลัก (แสดงเมนู)
app.get('/', async (req, res) => {
    try {
        const menu = await Product.findAll(); 
        res.render('index', { menu }); // เปลี่ยนเป็น 'index'
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).send('Error fetching menu');
    }
});

/* ========================================================
   ส่วน API สำหรับระบบรถเข็นโดยใช้ Order และ OrderDetail
   ======================================================== */

// เพิ่มสินค้าในรถเข็น (ถ้ายังไม่มี Order สำหรับลูกค้าจะสร้างใหม่)
app.post("/cart/add", async (req, res) => {
    try {
        const { customerId, productId, quantity } = req.body;

        // ตรวจสอบว่ามี customerId หรือไม่
        if (!customerId) {
            return res.status(400).json({ error: "Customer ID is required" });
        }

        // ค้นหา Order ที่ยังไม่มีการชำระ
        let order = await Order.findOne({ where: { Order_Customer_ID: customerId } });
        if (!order) {
            order = await Order.create({
                Order_Customer_ID: customerId,
                Order_Datetime: new Date(),
                Order_Total_Price: 0,
            });
        }

        // ค้นหาสินค้าจาก Product
        const product = await Product.findByPk(productId);
        if (!product) return res.status(404).json({ error: "Product not found" });

        // ตรวจสอบว่ามีรายการใน OrderDetail แล้วหรือไม่
        let orderDetail = await OrderDetail.findOne({ 
            where: { OrderDetail_Order_ID: order.Order_ID, OrderDetail_Product_ID: productId } 
        });

        if (orderDetail) {
            orderDetail.OrderDetail_Quantity += quantity;
            orderDetail.OrderDetail_Total_Price = orderDetail.OrderDetail_Quantity * product.Product_Price;
            await orderDetail.save();
        } else {
            await OrderDetail.create({
                OrderDetail_Order_ID: order.Order_ID,
                OrderDetail_Product_ID: productId,
                OrderDetail_Quantity: quantity,
                OrderDetail_Price_Unit: product.Product_Price,
                OrderDetail_Total_Price: quantity * product.Product_Price,
            });
        }

        // อัปเดตราคาสุทธิใน Order
        const total = await OrderDetail.sum("OrderDetail_Total_Price", { where: { OrderDetail_Order_ID: order.Order_ID } });
        order.Order_Total_Price = total || 0;
        await order.save();

        res.json({ message: "Product added to cart" });
    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ดึงข้อมูลรถเข็นของลูกค้า (แสดงหน้า cart ด้วย EJS)
app.get("/cart/:customerId", async (req, res) => {
  try {
      const { customerId } = req.params;
      const order = await Order.findOne({
          where: { Order_Customer_ID: customerId },
          include: [{ model: OrderDetail, include: [Product] }]
      });

      res.render("cart", { cart: order ? order.OrderDetails : [], total: order ? order.Order_Total_Price : 0 });
  } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ error: "Internal server error" });
  }
});

// อัปเดตจำนวนสินค้าในรถเข็น
app.post("/cart/update", async (req, res) => {
    try {
        const { customerId, productId, change } = req.body;
        const order = await Order.findOne({ where: { Order_Customer_ID: customerId } });
        if (!order) return res.status(404).json({ error: "Cart not found" });

        const orderDetail = await OrderDetail.findOne({ 
            where: { OrderDetail_Order_ID: order.Order_ID, OrderDetail_Product_ID: productId } 
        });
        if (!orderDetail) return res.status(404).json({ error: "Product not in cart" });

        orderDetail.OrderDetail_Quantity += change;
        if (orderDetail.OrderDetail_Quantity <= 0) {
            await orderDetail.destroy();
        } else {
            orderDetail.OrderDetail_Total_Price = orderDetail.OrderDetail_Quantity * orderDetail.OrderDetail_Price_Unit;
            await orderDetail.save();
        }

        const total = await OrderDetail.sum("OrderDetail_Total_Price", { where: { OrderDetail_Order_ID: order.Order_ID } });
        order.Order_Total_Price = total || 0;
        await order.save();

        res.json({ message: "Cart updated" });
    } catch (error) {
        console.error("Error updating cart:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ลบสินค้าออกจากรถเข็น
app.post("/cart/remove", async (req, res) => {
    try {
        const { customerId, productId } = req.body;
        const order = await Order.findOne({ where: { Order_Customer_ID: customerId } });
        if (!order) return res.status(404).json({ error: "Cart not found" });

        await OrderDetail.destroy({ where: { OrderDetail_Order_ID: order.Order_ID, OrderDetail_Product_ID: productId } });

        const total = await OrderDetail.sum("OrderDetail_Total_Price", { where: { OrderDetail_Order_ID: order.Order_ID } });
        order.Order_Total_Price = total || 0;
        await order.save();

        res.json({ message: "Product removed" });
    } catch (error) {
        console.error("Error removing product from cart:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// รีเซ็ตตระกร้าสินค้า
app.post("/cart/reset", async (req, res) => {
    const { customerId } = req.body;

    try {
        const order = await Order.findOne({ where: { Order_Customer_ID: customerId } });
        if (!order) return res.status(404).json({ error: "Cart not found" });

        await OrderDetail.destroy({ where: { OrderDetail_Order_ID: order.Order_ID } });

        // อัปเดตราคาสุทธิของ Order
        order.Order_Total_Price = 0;
        await order.save();

        res.json({ message: "Cart has been reset" });
    } catch (error) {
        console.error("Error resetting cart:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// หน้าชำระเงิน
app.get("/checkout/:customerId", async (req, res) => {
    try {
        const { customerId } = req.params;
  
        // ค้นหา Order ที่ยังไม่มีการชำระ
        let order = await Order.findOne({
            where: { Order_Customer_ID: customerId },
            include: [{ model: OrderDetail, include: [Product] }]
        });
  
        // ถ้าไม่มี Order ให้สร้างใหม่
        if (!order) {
            order = await Order.create({
                Order_Customer_ID: customerId,
                Order_Datetime: new Date(),
                Order_Total_Price: 0,
            });
        }
  
        res.render("checkout", { cart: order.OrderDetails, total: order.Order_Total_Price });
    } catch (error) {
        console.error("Error fetching checkout:", error);
        res.status(500).json({ error: "Internal server error" });
    }
  });
  app.delete('/OrderDetails/1', (req, res) => {
      const userId = req.params.id;
      db.run('DELETE FROM OrderDetails WHERE OrderDetail_ID = 1', function (err) {
          if (err) {
              return res.status(500).json({ error: err.message });
          }
          res.json({ message: 'User deleted', changes: this.changes });
      });
  });
  // Route สำหรับหน้า Payment
  app.get("/payment/:customerId", async (req, res) => {
      try {
          const { customerId } = req.params;
  
          // ค้นหา Order ที่ยังไม่มีการชำระ
          const order = await Order.findOne({
              where: { Order_Customer_ID: customerId },
              include: [{ model: OrderDetail, include: [Product] }]
          });
  
          if (!order) {
              return res.status(404).json({ error: "Order not found" });
          }
  
          // ส่งข้อมูล Order ไปยังหน้า Payment
          res.render("payment", { order });
      } catch (error) {
          console.error("Error fetching payment page:", error);
          res.status(500).json({ error: "Internal server error" });
      }
  });
  
  app.post("/payment/purchase", async (req, res) => {
      try {
          const { customerId, paymentType, discountAmount } = req.body;
  
          // ตรวจสอบว่าข้อมูลที่ส่งมาถูกต้อง
          if (!customerId || !paymentType) {
              return res.status(400).json({ error: "Customer ID and Payment Type are required" });
          }
  
          // ค้นหา Order ที่ยังไม่มีการชำระ
          let order = await Order.findOne({
              where: { Order_Customer_ID: customerId }
          });
  
          // ถ้าไม่มี Order ให้สร้างใหม่
          if (!order) {
              order = await Order.create({
                  Order_Customer_ID: customerId,
                  Order_Datetime: new Date(),
                  Order_Total_Price: 0, // เริ่มต้นที่ 0
              });
          }
  
          // คำนวณยอดรวม
          const total = await OrderDetail.sum("OrderDetail_Total_Price", { where: { OrderDetail_Order_ID: order.Order_ID } });
          order.Order_Total_Price = total || 0; // อัปเดตยอดรวม
          await order.save(); // บันทึกการเปลี่ยนแปลง
  
          const totalAmount = order.Order_Total_Price + 30; // รวมค่าจัดส่ง 30 บาท
          const finalAmount = totalAmount - (((discountAmount * -1) / 100) * order.Order_Total_Price);
  
          // สร้าง Payment
          const payment = await Payment.create({
              Payment_Type: paymentType,
              Payment_Amount: finalAmount,
              Payment_Date: new Date(),
              Payment_Order_ID: order.Order_ID,
              Payment_Discount: discountAmount,
              Payment_Status: "Completed",
          });
          order.Order_Total_Price = finalAmount; 
          await order.save(); 
  
          // ลบ OrderDetail หลังจากทำการชำระเงิน
          //await OrderDetail.destroy({ where: { OrderDetail_Order_ID: order.Order_ID } });
  
          res.json({ success: true, payment });
      } catch (error) {
          console.error("Error processing payment:", error);
          res.status(500).json({ error: error.message || "Internal server error" });
      }
  });
  
  app.post("/payment/confirm", async (req, res) => {
      try {
          const { customerId, paymentType, paymentAmount } = req.body;
  
          // ค้นหา Order ที่ยังไม่มีการชำระ
          const order = await Order.findOne({
              where: { Order_Customer_ID: customerId }
          });
  
          if (!order) {
              return res.status(404).json({ error: "Order not found" });
          }
  
          // สร้าง Payment
          const payment = await Payment.create({
              Payment_Type: paymentType,
              Payment_Amount: paymentAmount,
              Payment_Date: new Date(),
              Payment_Status: "Completed",
              Payment_Order_ID: order.Order_ID,
          });
  
          // อัปเดตสถานะ Order เป็น "Paid"
          payment.Payment_Status = "Pending";
          await order.save();
  
          res.json({ success: true, payment });
      } catch (error) {
          console.error("Error confirming payment:", error);
          res.status(500).json({ error: "Internal server error" });
      }
  });
  
  app.post("/promotion/check", async (req, res) => {
      try {
          const { promotionCode } = req.body;
  
          // ค้นหา Promotion จากฐานข้อมูล
          const promotion = await Promotion.findOne({
              where: { Promotion_Name: promotionCode }
          });
  
          if (!promotion) {
              return res.status(404).json({ error: "Promotion code not found" });
          }
  
          // ตรวจสอบวันที่ Promotion
          const currentDate = new Date();
          if (currentDate < promotion.Promotion_Start_Date || currentDate > promotion.Promotion_end_Date) {
              return res.status(400).json({ error: "Promotion code is expired" });
          }
  
          // ส่งส่วนลดกลับไป
          res.json({ discount: promotion.Promotion_Discount });
      } catch (error) {
          console.error("Error checking promotion:", error);
          res.status(500).json({ error: "Internal server error" });
      }
  });

  app.get('/login', (req, res) => {
    res.render('login'); // เรนเดอร์ไฟล์ login.ejs
});

/* ========================================================
   ส่วน API สำหรับระบบ login and Register
   ======================================================== */

// Route สำหรับการเข้าสู่ระบบ
app.post("/login", async (req, res) => {
    const { phone } = req.body; // ดึงเบอร์โทรศัพท์จาก body
    try {
        const user = await Customer.findOne({ where: { Customer_Phonenumber: phone } });
        if (user) {
            req.session.user = user; // บันทึกข้อมูล user ลงใน session
            return res.redirect("/"); // ส่งกลับการรีไดเรกต์ไปที่หน้า index
        } else {
            return res.redirect('http://localhost:3000'); // เปลี่ยนเส้นทางไปที่หน้า login
        }
    } catch (error) {
        console.error("Error during login:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});


// เส้นทางสำหรับหน้า register (GET)
app.get('/register', (req, res) => {
    res.render('register'); // เรนเดอร์ไฟล์ register.ejs
});

// เส้นทางสำหรับการลงทะเบียน (POST)
app.post('/register', async (req, res) => {
    const { name, address, phone } = req.body; // ดึงข้อมูลจากฟอร์ม
    try {
        // สร้างผู้ใช้ใหม่ในฐานข้อมูล
        const newUser  = await Customer.create({
            Customer_Name: name,
            Customer_address: address,
            Customer_Phonenumber: phone
        });
        // รีไดเรกต์ไปที่หน้า login หลังจากลงทะเบียนสำเร็จ
        return res.redirect('/login');
    } catch (error) {
        console.error("Error during registration:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

/* ========================================================
   ส่วน API สำหรับ Admin
   ======================================================== */







const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});