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

  /* ========================================================
   ส่วน API สำหรับระบบ login , logout and Register
   ======================================================== */

  app.get('/login', (req, res) => {
    res.render('login'); // เรนเดอร์ไฟล์ login.ejs
});


// Route สำหรับการเข้าสู่ระบบ
app.post("/login", async (req, res) => {
    const { phone } = req.body; // รับเบอร์โทรศัพท์จาก body

    try {
        const user = await Customer.findOne({ where: { Customer_Phonenumber: phone } });

        if (user) {
            req.session.user = user; // บันทึกข้อมูล user ลงใน session

            // เช็คว่าเบอร์โทรศัพท์นี้เป็นของ Admin หรือไม่
            if (phone === "0999999999") {  
                return res.redirect("/admin"); // ถ้าเป็น Admin ให้ไปหน้า Admin
            } else {
                return res.redirect("/"); // ถ้าไม่ใช่ให้ไปหน้า index
            }
        } else {
            return res.redirect("/login"); // ถ้าไม่พบผู้ใช้ให้กลับไปหน้า login
        }
    } catch (error) {
        console.error("Error during login:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// Route สำหรับ log out
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Error logging out.");
        }
        res.redirect('/login'); // เมื่อ log out สำเร็จ ให้ redirect ไปที่หน้า login
    });
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
// Route สำหรับหน้า Admin

app.get('/admin', (req, res) => {
    if (req.session.user && req.session.user.Customer_Phonenumber === '0999999999') {
        res.render('admin');  // ถ้าเป็น Admin ให้ไปหน้า Admin
    } else {
        res.redirect('/login');  // ถ้าไม่ใช่ให้ไปหน้า login
    }
});

// customers add edit deleate 
app.get('/customers', async (req, res) => {
    try {
        // ดึงข้อมูลลูกค้าจากฐานข้อมูล
        const customers = await Customer.findAll();
        res.render('customers', { customers: customers }); // ส่งข้อมูลลูกค้าไปที่ customers.ejs
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).send('Error fetching customers');
    }
});

/*     app.post('/customers', async (req, res) => {
        const { Customer_Name, Customer_Phonenumber, Customer_address } = req.body;

        try {
            await Customer.create({
                Customer_Name,
                Customer_Phonenumber,
                Customer_address
            });

            res.redirect('/customers');  // รีเฟรชหน้า
        } catch (error) {
            console.error("Error adding customer:", error);
            res.status(500).send("Error adding customer.");
        }
    }); */

app.get('/customers/edit/:phone', async (req, res) => {
    const { phone } = req.params;

    try {
        const customer = await Customer.findOne({ where: { Customer_Phonenumber: phone } });

        if (customer) {
            res.render('edit', { customer });
        } else {
            res.status(404).send('Customer not found');
        }
    } catch (error) {
        console.error("Error fetching customer for edit:", error);
        res.status(500).send("Error fetching customer for edit.");
    }
});

app.post('/customers/edit/:phone', async (req, res) => {
    const { phone } = req.params;
    const { Customer_Name, Customer_address } = req.body;

    try {
        const customer = await Customer.findOne({ where: { Customer_Phonenumber: phone } });

        if (customer) {
            customer.Customer_Name = Customer_Name;
            customer.Customer_address = Customer_address;
            await customer.save();

            res.redirect('/customers');  // กลับไปที่หน้ารายชื่อลูกค้า
        } else {
            res.status(404).send('Customer not found');
        }
    } catch (error) {
        console.error("Error updating customer:", error);
        res.status(500).send("Error updating customer.");
    }
});

app.post('/customers/delete/:phone', async (req, res) => {
    const { phone } = req.params;

    try {
        const customer = await Customer.findOne({ where: { Customer_Phonenumber: phone } });

        if (customer) {
            await customer.destroy();  // ลบข้อมูลลูกค้า
            res.redirect('/customers');  // รีเฟรชหน้า
        } else {
            res.status(404).send('Customer not found');
        }
    } catch (error) {
        console.error("Error deleting customer:", error);
        res.status(500).send("Error deleting customer.");
    }
});

//employee add deleate edit
app.get('/employees', async (req, res) => {
    try {
        const employees = await Employees.findAll();
        res.render('employees', { employees: employees });
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).send('Error fetching employees');
    }
});

app.post('/employees', async (req, res) => {
    const { Employees_Name, Employees_Phonenumber, Employees_Position } = req.body;

    try {
        await Employees.create({
            Employees_Name,
            Employees_Phonenumber,
            Employees_Position
        });

        res.redirect('/employees');  // รีเฟรชหน้า
    } catch (error) {
        console.error("Error adding employees:", error);
        res.status(500).send("Error adding employees.");
    }
});

// หน้าแก้ไขพนักงาน
app.get('/employees/edit/:phone', async (req, res) => {
    const { phone } = req.params;

    try {
        const employee = await Employees.findOne({ where: { Employees_Phonenumber: phone } }); // แก้ไขเป็น Employees

        if (employee) {
            res.render('edit-employee', { employee });
        } else {
            res.status(404).send('Employee not found');
        }
    } catch (error) {
        console.error("Error fetching employees for edit:", error);
        res.status(500).send("Error fetching employees for edit.");
    }
});

// ฟอร์มบันทึกการแก้ไขพนักงาน
app.post('/employees/edit/:phone', async (req, res) => {
    const { phone } = req.params;
    const { Employees_Name, Employees_Position } = req.body;

    try {
        const employee = await Employees.findOne({ where: { Employees_Phonenumber: phone } }); // แก้ไขเป็น Employees

        if (employee) {
            employee.Employees_Name = Employees_Name;
            employee.Employees_Position = Employees_Position;
            await employee.save();

            res.redirect('/employees');  // กลับไปที่หน้ารายชื่อพนักงาน
        } else {
            res.status(404).send('Employee not found');
        }
    } catch (error) {
        console.error("Error updating employees:", error);
        res.status(500).send("Error updating employees.");
    }
});

// ฟังก์ชันลบพนักงาน
app.post('/employees/delete/:phone', async (req, res) => {
    const { phone } = req.params;

    try {
        const employee = await Employees.findOne({ where: { Employees_Phonenumber: phone } }); // แก้ไขเป็น Employees

        if (employee) {
            await employee.destroy();  // ลบข้อมูลพนักงาน
            res.redirect('/employees');  // รีเฟรชหน้า
        } else {
            res.status(404).send('Employee not found');
        }
    } catch (error) {
        console.error("Error deleting employees:", error);
        res.status(500).send("Error deleting employees.");
    }
});

//product add edit deleate
// แสดงรายการสินค้า
app.get('/products', async (req, res) => {
    try {
        const products = await Product.findAll();
        res.render('products', { products: products });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Error fetching products');
    }
});

// เพิ่มสินค้าใหม่
app.post('/products', async (req, res) => {
    const { Product_Name, Product_Price, Product_Description } = req.body;

    try {
        await Product.create({
            Product_Name,
            Product_Price,
            Product_Description
        });

        res.redirect('/products');  // รีเฟรชหน้า
    } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).send("Error adding product.");
    }
});

// หน้าแก้ไขสินค้า
app.get('/products/edit/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const product = await Product.findOne({ where: { id: id } });  // ใช้ id ของสินค้า

        if (product) {
            res.render('edit-product', { product });
        } else {
            res.status(404).send('Product not found');
        }
    } catch (error) {
        console.error("Error fetching product for edit:", error);
        res.status(500).send("Error fetching product for edit.");
    }
});

// ฟอร์มบันทึกการแก้ไขสินค้า
app.post('/products/edit/:id', async (req, res) => {
    const { id } = req.params;
    const { Product_Name, Product_Price, Product_Description } = req.body;

    try {
        const product = await Product.findOne({ where: { id: id } });

        if (product) {
            product.Product_Name = Product_Name;
            product.Product_Price = Product_Price;
            product.Product_Description = Product_Description;
            await product.save();

            res.redirect('/products');  // กลับไปที่หน้ารายการสินค้า
        } else {
            res.status(404).send('Product not found');
        }
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).send("Error updating product.");
    }
});

// ฟังก์ชันลบสินค้า
app.post('/products/delete/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const product = await Product.findOne({ where: { id: id } });

        if (product) {
            await product.destroy();  // ลบข้อมูลสินค้า
            res.redirect('/products');  // รีเฟรชหน้า
        } else {
            res.status(404).send('Product not found');
        }
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).send("Error deleting product.");
    }
});

// แสดงรายการสินค้า
app.get('/products', async (req, res) => {
    try {
        const products = await Product.findAll();
        res.render('products', { products: products });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Error fetching products');
    }
});

// เพิ่มสินค้าใหม่
app.post('/products', async (req, res) => {
    const { Product_Name, Product_Price, Product_Description } = req.body;

    try {
        await Product.create({ Product_Name, Product_Price, Product_Description });
        res.redirect('/products');
    } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).send("Error adding product.");
    }
});

// แก้ไขสินค้า
app.get('/products/edit/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const product = await Product.findOne({ where: { id: id } });

        if (product) {
            res.render('edit-product', { product });
        } else {
            res.status(404).send('Product not found');
        }
    } catch (error) {
        console.error("Error fetching product for edit:", error);
        res.status(500).send("Error fetching product for edit.");
    }
});

// บันทึกการแก้ไขสินค้า
app.post('/products/edit/:id', async (req, res) => {
    const { id } = req.params;
    const { Product_Name, Product_Price, Product_Description } = req.body;

    try {
        const product = await Product.findOne({ where: { id: id } });

        if (product) {
            product.Product_Name = Product_Name;
            product.Product_Price = Product_Price;
            product.Product_Description = Product_Description;
            await product.save();
            res.redirect('/products');
        } else {
            res.status(404).send('Product not found');
        }
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).send("Error updating product.");
    }
});

// ลบสินค้า
app.post('/products/delete/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const product = await Product.findOne({ where: { id: id } });

        if (product) {
            await product.destroy();
            res.redirect('/products');
        } else {
            res.status(404).send('Product not found');
        }
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).send("Error deleting product.");
    }
});

//promotion add //
// แสดงรายการโปรโมชั่น
app.get('/promotions', async (req, res) => {
    try {
        const promotions = await Promotion.findAll();
        res.render('promotions', { promotions: promotions });
    } catch (error) {
        console.error('Error fetching promotions:', error);
        res.status(500).send('Error fetching promotions');
    }
});

// เพิ่มโปรโมชั่นใหม่
app.post('/promotions', async (req, res) => {
    const { Promotion_Name, Discount, Promotion_Description, Start_Date, End_Date } = req.body;

    try {
        await Promotion.create({ Promotion_Name, Discount, Promotion_Description, Start_Date, End_Date });
        res.redirect('/promotions');
    } catch (error) {
        console.error("Error adding promotion:", error);
        res.status(500).send("Error adding promotion.");
    }
});

// แก้ไขโปรโมชั่น
app.get('/promotions/edit/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const promotion = await Promotion.findOne({ where: { id: id } });

        if (promotion) {
            res.render('edit-promotion', { promotion });
        } else {
            res.status(404).send('Promotion not found');
        }
    } catch (error) {
        console.error("Error fetching promotion for edit:", error);
        res.status(500).send("Error fetching promotion for edit.");
    }
});

// บันทึกการแก้ไขโปรโมชั่น
app.post('/promotions/edit/:id', async (req, res) => {
    const { id } = req.params;
    const { Promotion_Name, Discount, Promotion_Description, Start_Date, End_Date } = req.body;

    try {
        const promotion = await Promotion.findOne({ where: { id: id } });

        if (promotion) {
            promotion.Promotion_Name = Promotion_Name;
            promotion.Discount = Discount;
            promotion.Promotion_Description = Promotion_Description;
            promotion.Start_Date = Start_Date;
            promotion.End_Date = End_Date;
            await promotion.save();
            res.redirect('/promotions');
        } else {
            res.status(404).send('Promotion not found');
        }
    } catch (error) {
        console.error("Error updating promotion:", error);
        res.status(500).send("Error updating promotion.");
    }
});

// ลบโปรโมชั่น
app.post('/promotions/delete/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const promotion = await Promotion.findOne({ where: { id: id } });

        if (promotion) {
            await promotion.destroy();
            res.redirect('/promotions');
        } else {
            res.status(404).send('Promotion not found');
        }
    } catch (error) {
        console.error("Error deleting promotion:", error);
        res.status(500).send("Error deleting promotion.");
    }
});

// แสดงรายการการจัดส่ง
app.get('/deliveries', async (req, res) => {
    try {
        const deliveries = await Delivery.findAll();
        res.render('deliveries', { deliveries: deliveries });
    } catch (error) {
        console.error('Error fetching deliveries:', error);
        res.status(500).send('Error fetching deliveries');
    }
});

// เพิ่มการจัดส่งใหม่
app.post('/deliveries', async (req, res) => {
    const { Delivery_Status, Delivery_date } = req.body;

    try {
        await Delivery.create({ Delivery_Status, Delivery_date });
        res.redirect('/deliveries');  // รีเฟรชหน้า
    } catch (error) {
        console.error("Error adding delivery:", error);
        res.status(500).send("Error adding delivery.");
    }
});

// แก้ไขการจัดส่ง
app.get('/deliveries/edit/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const delivery = await Delivery.findOne({ where: { id: id } });

        if (delivery) {
            res.render('edit-delivery', { delivery });
        } else {
            res.status(404).send('Delivery not found');
        }
    } catch (error) {
        console.error("Error fetching delivery for edit:", error);
        res.status(500).send("Error fetching delivery for edit.");
    }
});

// บันทึกการแก้ไขการจัดส่ง
app.post('/deliveries/edit/:id', async (req, res) => {
    const { id } = req.params;
    const { Delivery_Status, Delivery_date } = req.body;

    try {
        const delivery = await Delivery.findOne({ where: { id: id } });

        if (delivery) {
            delivery.Delivery_Status = Delivery_Status;
            delivery.Delivery_date = Delivery_date;
            await delivery.save();
            res.redirect('/deliveries');  // กลับไปที่หน้ารายการการจัดส่ง
        } else {
            res.status(404).send('Delivery not found');
        }
    } catch (error) {
        console.error("Error updating delivery:", error);
        res.status(500).send("Error updating delivery.");
    }
});

// ลบการจัดส่ง
app.post('/deliveries/delete/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const delivery = await Delivery.findOne({ where: { id: id } });

        if (delivery) {
            await delivery.destroy();  // ลบการจัดส่ง
            res.redirect('/deliveries');  // รีเฟรชหน้า
        } else {
            res.status(404).send('Delivery not found');
        }
    } catch (error) {
        console.error("Error deleting delivery:", error);
        res.status(500).send("Error deleting delivery.");
    }
});

app.post('/orders', async (req, res) => {
    const { Order_Datetime, Order_Total_Price, Order_Customer_ID } = req.body;

    try {
        await Order.create({
            Order_Datetime,
            Order_Total_Price,
            Order_Customer_ID
        });
        res.redirect('/orders');  // ไปยังหน้า Orders
    } catch (error) {
        console.error("Error adding order:", error);
        res.status(500).send("Error adding order.");
    }
});

app.get('/orders', async (req, res) => {
    try {
        const orders = await Order.findAll();
        res.render('orders', { orders: orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Error fetching orders');
    }
});

app.get('/orders/edit/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const order = await Order.findOne({ where: { Order_ID: id } });

        if (order) {
            res.render('edit-order', { order });
        } else {
            res.status(404).send('Order not found');
        }
    } catch (error) {
        console.error("Error fetching order for edit:", error);
        res.status(500).send("Error fetching order for edit.");
    }
});

app.post('/orders/edit/:id', async (req, res) => {
    const { id } = req.params;
    const { Order_Datetime, Order_Total_Price, Order_Customer_ID } = req.body;

    try {
        const order = await Order.findOne({ where: { Order_ID: id } });

        if (order) {
            order.Order_Datetime = Order_Datetime;
            order.Order_Total_Price = Order_Total_Price;
            order.Order_Customer_ID = Order_Customer_ID;
            await order.save();
            res.redirect('/orders');
        } else {
            res.status(404).send('Order not found');
        }
    } catch (error) {
        console.error("Error updating order:", error);
        res.status(500).send("Error updating order.");
    }
});

app.post('/orders/delete/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const order = await Order.findOne({ where: { Order_ID: id } });

        if (order) {
            await order.destroy();
            res.redirect('/orders');
        } else {
            res.status(404).send('Order not found');
        }
    } catch (error) {
        console.error("Error deleting order:", error);
        res.status(500).send("Error deleting order.");
    }
});




const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});