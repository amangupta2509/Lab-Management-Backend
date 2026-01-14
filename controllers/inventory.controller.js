/**
 * Inventory Controller - Complete Implementation
 * Lab Management System
 */

const db = require("../config/database");

/* ===== LAB INVENTORY ===== */

exports.addLabInventoryItem = async (req, res) => {
  try {
    const {
      item_name,
      category,
      current_stock,
      unit,
      location,
      manufacturer,
      lot_number,
      expiration_date,
      reorder_point,
      tentative_order_quantity,
      supplier,
      distributor_details,
      contact_number,
      notes,
    } = req.body;

    if (!item_name) {
      return res
        .status(400)
        .json({ success: false, message: "Item name is required" });
    }

    const [result] = await db.query(
      `INSERT INTO lab_inventory
      (item_name, category, current_stock, unit, location, manufacturer, lot_number,
       expiration_date, reorder_point, tentative_order_quantity, supplier,
       distributor_details, contact_number, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        item_name,
        category,
        current_stock || 0,
        unit,
        location,
        manufacturer,
        lot_number,
        expiration_date,
        reorder_point,
        tentative_order_quantity,
        supplier,
        distributor_details,
        contact_number,
        notes,
        req.userId,
      ]
    );

    if (current_stock > 0) {
      await db.query(
        `INSERT INTO inventory_transactions
        (inventory_type, item_id, transaction_type, quantity, reference_type, performed_by, remarks)
        VALUES (?,?,?,?,?,?,?)`,
        [
          "LAB",
          result.insertId,
          "IN",
          current_stock,
          "INITIAL_STOCK",
          req.userId,
          "Initial stock",
        ]
      );
    }

    res.status(201).json({
      success: true,
      message: "Lab inventory added",
      itemId: result.insertId,
    });
  } catch (error) {
    console.error("Add lab inventory error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getLabInventory = async (req, res) => {
  try {
    const { category, location, reorder_status, search } = req.query;
    let query = `SELECT * FROM lab_inventory WHERE 1=1`;
    const params = [];

    if (category) {
      query += " AND category = ?";
      params.push(category);
    }
    if (location) {
      query += " AND location = ?";
      params.push(location);
    }
    if (reorder_status) {
      query += " AND reorder_status = ?";
      params.push(reorder_status);
    }
    if (search) {
      query += " AND (item_name LIKE ? OR manufacturer LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    query += " ORDER BY updated_at DESC";
    const [items] = await db.query(query, params);

    const [[stats]] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN reorder_status = 'REORDER_REQUIRED' THEN 1 ELSE 0 END) as reorder_needed,
        SUM(CASE WHEN expiration_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) 
            AND expiration_date >= CURDATE() THEN 1 ELSE 0 END) as expiring_soon
      FROM lab_inventory
    `);

    res.json({ success: true, count: items.length, items, stats });
  } catch (error) {
    console.error("Get lab inventory error:", error);
    res.status(500).json({ success: false });
  }
};

exports.updateLabInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      item_name,
      category,
      current_stock,
      unit,
      location,
      manufacturer,
      lot_number,
      expiration_date,
      reorder_point,
      tentative_order_quantity,
      supplier,
      distributor_details,
      contact_number,
      notes,
    } = req.body;

    const [[existing]] = await db.query(
      "SELECT * FROM lab_inventory WHERE id = ?",
      [id]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    await db.query(
      `UPDATE lab_inventory SET 
        item_name = COALESCE(?, item_name),
        category = COALESCE(?, category),
        current_stock = COALESCE(?, current_stock),
        unit = COALESCE(?, unit),
        location = COALESCE(?, location),
        manufacturer = COALESCE(?, manufacturer),
        lot_number = COALESCE(?, lot_number),
        expiration_date = COALESCE(?, expiration_date),
        reorder_point = COALESCE(?, reorder_point),
        tentative_order_quantity = COALESCE(?, tentative_order_quantity),
        supplier = COALESCE(?, supplier),
        distributor_details = COALESCE(?, distributor_details),
        contact_number = COALESCE(?, contact_number),
        notes = COALESCE(?, notes),
        updated_at = NOW()
      WHERE id = ?`,
      [
        item_name,
        category,
        current_stock,
        unit,
        location,
        manufacturer,
        lot_number,
        expiration_date,
        reorder_point,
        tentative_order_quantity,
        supplier,
        distributor_details,
        contact_number,
        notes,
        id,
      ]
    );

    res.json({ success: true, message: "Updated successfully" });
  } catch (error) {
    console.error("Update lab inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update inventory",
    });
  }
};

exports.deleteLabInventory = async (req, res) => {
  try {
    await db.query("DELETE FROM lab_inventory WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    console.error("Delete lab inventory error:", error);
    res.status(500).json({ success: false });
  }
};

/* ===== NGS INVENTORY ===== */

exports.addNgsInventoryItem = async (req, res) => {
  try {
    const {
      item_name,
      manufacturer,
      catalog_number,
      lot_number,
      expiration_date,
      quantity_in_stock,
      unit,
      location,
      reorder_point,
      notes,
    } = req.body;

    if (!item_name) {
      return res
        .status(400)
        .json({ success: false, message: "Item name required" });
    }

    if (notes && notes.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Notes too long (max 1000 characters)",
      });
    }

    const [result] = await db.query(
      `INSERT INTO ngs_inventory
      (item_name, manufacturer, catalog_number, lot_number, expiration_date,
       quantity_in_stock, unit, location, reorder_point, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        item_name,
        manufacturer,
        catalog_number,
        lot_number,
        expiration_date,
        quantity_in_stock || 0,
        unit,
        location,
        reorder_point,
        notes,
        req.userId,
      ]
    );

    if (quantity_in_stock > 0) {
      await db.query(
        `INSERT INTO inventory_transactions
        (inventory_type, item_id, transaction_type, quantity, reference_type, performed_by)
        VALUES (?,?,?,?,?,?)`,
        [
          "NGS",
          result.insertId,
          "IN",
          quantity_in_stock,
          "INITIAL_STOCK",
          req.userId,
        ]
      );
    }

    res.status(201).json({
      success: true,
      message: "NGS inventory added",
      itemId: result.insertId,
    });
  } catch (error) {
    console.error("Add NGS inventory error:", error);
    res.status(500).json({ success: false });
  }
};

exports.getNgsInventory = async (req, res) => {
  try {
    const { location, reorder_status, search } = req.query;
    let query = `SELECT * FROM ngs_inventory WHERE 1=1`;
    const params = [];

    if (location) {
      query += " AND location = ?";
      params.push(location);
    }
    if (reorder_status) {
      query += " AND reorder_status = ?";
      params.push(reorder_status);
    }
    if (search) {
      query += " AND (item_name LIKE ? OR catalog_number LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    query += " ORDER BY updated_at DESC";
    const [items] = await db.query(query, params);

    const [[stats]] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN reorder_status = 'REORDER_REQUIRED' THEN 1 ELSE 0 END) as reorder_needed
      FROM ngs_inventory
    `);

    res.json({ success: true, count: items.length, items, stats });
  } catch (error) {
    console.error("Get NGS inventory error:", error);
    res.status(500).json({ success: false });
  }
};

exports.updateNgsInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      item_name,
      manufacturer,
      catalog_number,
      lot_number,
      expiration_date,
      quantity_in_stock,
      unit,
      location,
      reorder_point,
      notes,
    } = req.body;

    await db.query(
      `UPDATE ngs_inventory SET 
        item_name = COALESCE(?, item_name),
        manufacturer = COALESCE(?, manufacturer),
        catalog_number = COALESCE(?, catalog_number),
        lot_number = COALESCE(?, lot_number),
        expiration_date = COALESCE(?, expiration_date),
        quantity_in_stock = COALESCE(?, quantity_in_stock),
        unit = COALESCE(?, unit),
        location = COALESCE(?, location),
        reorder_point = COALESCE(?, reorder_point),
        notes = COALESCE(?, notes),
        updated_at = NOW()
      WHERE id = ?`,
      [
        item_name,
        manufacturer,
        catalog_number,
        lot_number,
        expiration_date,
        quantity_in_stock,
        unit,
        location,
        reorder_point,
        notes,
        id,
      ]
    );

    res.json({ success: true, message: "Updated successfully" });
  } catch (error) {
    console.error("Update NGS inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update",
    });
  }
};

exports.deleteNgsInventory = async (req, res) => {
  try {
    await db.query("DELETE FROM ngs_inventory WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    console.error("Delete NGS inventory error:", error);
    res.status(500).json({ success: false });
  }
};

/* ===== TRANSACTIONS ===== */

exports.consumeInventory = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const {
      inventory_type,
      item_id,
      quantity,
      reference_type,
      reference_id,
      remarks,
    } = req.body;

    if (!inventory_type || !item_id || !quantity || quantity <= 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: "Invalid input" });
    }

    const table = inventory_type === "LAB" ? "lab_inventory" : "ngs_inventory";
    const field =
      inventory_type === "LAB" ? "current_stock" : "quantity_in_stock";

    const [[item]] = await connection.query(
      `SELECT ${field} as stock FROM ${table} WHERE id = ? FOR UPDATE`,
      [item_id]
    );

    if (!item) {
      await connection.rollback();
      connection.release();
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    if (item.stock < quantity) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${item.stock}`,
      });
    }

    await connection.query(
      `UPDATE ${table} SET ${field} = ${field} - ? WHERE id = ?`,
      [quantity, item_id]
    );

    await connection.query(
      `INSERT INTO inventory_transactions
       (inventory_type, item_id, transaction_type, quantity, reference_type, reference_id, performed_by, remarks)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        inventory_type,
        item_id,
        "OUT",
        quantity,
        reference_type,
        reference_id,
        req.userId,
        remarks,
      ]
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: "Consumed",
      remaining: item.stock - quantity,
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error("Consume error:", error);
    res.status(500).json({ success: false });
  }
};

exports.adjustInventory = async (req, res) => {
  const { inventory_type, item_id, new_quantity, remarks } = req.body;
  try {
    const table = inventory_type === "LAB" ? "lab_inventory" : "ngs_inventory";
    const field =
      inventory_type === "LAB" ? "current_stock" : "quantity_in_stock";

    const [[item]] = await db.query(
      `SELECT ${field} as stock FROM ${table} WHERE id = ?`,
      [item_id]
    );
    if (!item)
      return res.status(404).json({ success: false, message: "Not found" });

    const diff = new_quantity - item.stock;
    await db.query(`UPDATE ${table} SET ${field} = ? WHERE id = ?`, [
      new_quantity,
      item_id,
    ]);
    await db.query(
      `INSERT INTO inventory_transactions
      (inventory_type, item_id, transaction_type, quantity, performed_by, remarks)
      VALUES (?,?,?,?,?,?)`,
      [
        inventory_type,
        item_id,
        "ADJUSTMENT",
        Math.abs(diff),
        req.userId,
        remarks,
      ]
    );

    res.json({ success: true, old: item.stock, new: new_quantity, diff });
  } catch (error) {
    console.error("Adjust error:", error);
    res.status(500).json({ success: false });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { inventory_type, item_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT t.*, u.name as performed_by_name FROM inventory_transactions t
                 LEFT JOIN users u ON t.performed_by = u.id WHERE 1=1`;
    const params = [];

    if (inventory_type) {
      query += " AND t.inventory_type = ?";
      params.push(inventory_type);
    }
    if (item_id) {
      query += " AND t.item_id = ?";
      params.push(item_id);
    }

    query += " ORDER BY t.created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), offset);

    const [transactions] = await db.query(query, params);
    res.json({ success: true, count: transactions.length, transactions });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ success: false });
  }
};

/* ===== ALERTS ===== */

exports.getInventoryAlerts = async (req, res) => {
  try {
    const [alerts] = await db.query(
      `SELECT * FROM inventory_alerts WHERE is_resolved = FALSE ORDER BY severity DESC, created_at DESC`
    );
    res.json({ success: true, count: alerts.length, alerts });
  } catch (error) {
    console.error("Get alerts error:", error);
    res.status(500).json({ success: false });
  }
};

exports.generateAlerts = async (req, res) => {
  try {
    const alerts = [];

    // Lab inventory alerts
    const [labItems] = await db.query(`
      SELECT * FROM lab_inventory
      WHERE reorder_status = 'REORDER_REQUIRED' OR expiration_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
    `);

    for (const item of labItems) {
      if (item.reorder_status === "REORDER_REQUIRED") {
        const [[exists]] = await db.query(
          `SELECT id FROM inventory_alerts WHERE inventory_type='LAB' AND item_id=? 
           AND alert_type='LOW_STOCK' AND is_resolved=FALSE`,
          [item.id]
        );
        if (!exists) {
          await db.query(
            `INSERT INTO inventory_alerts (inventory_type, item_id, item_name, alert_type, alert_message, severity)
             VALUES (?,?,?,?,?,?)`,
            [
              "LAB",
              item.id,
              item.item_name,
              "LOW_STOCK",
              `${item.item_name} below reorder point`,
              "HIGH",
            ]
          );
          alerts.push({ item: item.item_name, type: "LOW_STOCK" });
        }
      }

      if (item.expiration_date) {
        const days = Math.ceil(
          (new Date(item.expiration_date) - new Date()) / 86400000
        );
        let alertType = null,
          severity = null;

        if (days < 0) {
          alertType = "EXPIRED";
          severity = "CRITICAL";
        } else if (days <= 30) {
          alertType = "EXPIRY_CRITICAL";
          severity = "CRITICAL";
        } else if (days <= 90) {
          alertType = "EXPIRY_WARNING";
          severity = "MEDIUM";
        }

        if (alertType) {
          const [[exists]] = await db.query(
            `SELECT id FROM inventory_alerts WHERE inventory_type='LAB' AND item_id=? 
             AND alert_type=? AND is_resolved=FALSE`,
            [item.id, alertType]
          );
          if (!exists) {
            await db.query(
              `INSERT INTO inventory_alerts (inventory_type, item_id, item_name, alert_type, alert_message, severity)
               VALUES (?,?,?,?,?,?)`,
              [
                "LAB",
                item.id,
                item.item_name,
                alertType,
                `${item.item_name} ${
                  days < 0 ? "expired" : `expires in ${days}d`
                }`,
                severity,
              ]
            );
            alerts.push({ item: item.item_name, type: alertType });
          }
        }
      }
    }

    // NGS inventory alerts (similar logic)
    const [ngsItems] = await db.query(`
      SELECT * FROM ngs_inventory WHERE reorder_status = 'REORDER_REQUIRED'
    `);

    for (const item of ngsItems) {
      const [[exists]] = await db.query(
        `SELECT id FROM inventory_alerts WHERE inventory_type='NGS' AND item_id=? 
         AND alert_type='LOW_STOCK' AND is_resolved=FALSE`,
        [item.id]
      );
      if (!exists) {
        await db.query(
          `INSERT INTO inventory_alerts (inventory_type, item_id, item_name, alert_type, alert_message, severity)
           VALUES (?,?,?,?,?,?)`,
          [
            "NGS",
            item.id,
            item.item_name,
            "LOW_STOCK",
            `${item.item_name} below reorder point`,
            "HIGH",
          ]
        );
        alerts.push({ item: item.item_name, type: "LOW_STOCK" });
      }
    }

    res.json({
      success: true,
      message: `${alerts.length} alerts generated`,
      alerts,
    });
  } catch (error) {
    console.error("Generate alerts error:", error);
    res.status(500).json({ success: false });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    await db.query(
      `UPDATE inventory_alerts SET is_resolved=TRUE, resolved_by=?, resolved_at=NOW() WHERE id=?`,
      [req.userId, req.params.id]
    );
    res.json({ success: true, message: "Alert resolved" });
  } catch (error) {
    console.error("Resolve alert error:", error);
    res.status(500).json({ success: false });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const { project_type, run_status, extraction_status, library_status } =
      req.query;
    let query = "SELECT * FROM projects WHERE 1=1";
    const params = [];

    if (project_type) {
      query += " AND project_type = ?";
      params.push(project_type);
    }
    if (run_status) {
      query += " AND run_status = ?";
      params.push(run_status);
    }
    if (extraction_status) {
      query += " AND extraction_status = ?";
      params.push(extraction_status);
    }
    if (library_status) {
      query += " AND library_status = ?";
      params.push(library_status);
    }

    query += " ORDER BY created_at DESC";
    const [projects] = await db.query(query, params);

    res.json({
      success: true,
      count: projects.length,
      projects,
    });
  } catch (error) {
    console.error("Get projects error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
    });
  }
};

/* ===== PROJECTS ===== */

exports.createProject = async (req, res) => {
  try {
    const data = req.body;
    const userId = req.userId;

    if (!data.project_type) {
      return res.status(400).json({
        success: false,
        message: "Project type required",
      });
    }

    if (data.notes && data.notes.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Notes too long (max 2000 characters)",
      });
    }

    const [result] = await db.query(
      `INSERT INTO projects (
        project_type, project_description, client_name,
        sample_receiving_date, sample_size, sample_type, species,
        extraction_needed, extraction_status,
        storage_unit, storage_condition,
        library_type, library_status, library_date,
        pcr_type, run_facility, run_status, run_date,
        srf_link, notes, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        data.project_type,
        data.project_description,
        data.client_name,
        data.sample_receiving_date,
        data.sample_size,
        data.sample_type,
        data.species,
        data.extraction_needed,
        data.extraction_status,
        data.storage_unit,
        data.storage_condition,
        data.library_type,
        data.library_status,
        data.library_date,
        data.pcr_type,
        data.run_facility,
        data.run_status,
        data.run_date,
        data.srf_link,
        data.notes,
        userId,
      ]
    );

    res.status(201).json({
      success: true,
      projectId: result.insertId,
    });
  } catch (error) {
    console.error("Create project error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create project",
    });
  }
};

// exports.createProject = async (req, res) => {
//   try {
//     const data = req.body;
//     const userId = req.userId;

//     const [result] = await db.query(
//       `INSERT INTO projects (
//         project_type, project_description, client_name,
//         sample_receiving_date, sample_size, sample_type, species,
//         extraction_needed, extraction_status,
//         storage_unit, storage_condition,
//         library_type, library_status, library_date,
//         pcr_type, run_facility, run_status, run_date,
//         srf_link, notes, created_by
//       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//       [
//         data.project_type,
//         data.project_description,
//         data.client_name,
//         data.sample_receiving_date,
//         data.sample_size,
//         data.sample_type,
//         data.species,
//         data.extraction_needed,
//         data.extraction_status,
//         data.storage_unit,
//         data.storage_condition,
//         data.library_type,
//         data.library_status,
//         data.library_date,
//         data.pcr_type,
//         data.run_facility,
//         data.run_status,
//         data.run_date,
//         data.srf_link,
//         data.notes,
//         userId,
//       ]
//     );

//     res.status(201).json({
//       success: true,
//       projectId: result.insertId,
//     });
//   } catch (error) {
//     console.error("Create project error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to create project",
//     });
//   }
// };

exports.getProjects = async (req, res) => {
  try {
    const { project_type, run_status } = req.query;
    let query = "SELECT * FROM projects WHERE 1=1";
    const params = [];

    if (project_type) {
      query += " AND project_type = ?";
      params.push(project_type);
    }
    if (run_status) {
      query += " AND run_status = ?";
      params.push(run_status);
    }

    query += " ORDER BY created_at DESC";
    const [projects] = await db.query(query, params);

    res.json({ success: true, count: projects.length, projects });
  } catch (error) {
    console.error("Get projects error:", error);
    res.status(500).json({ success: false });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      project_type,
      project_description,
      client_name,
      sample_receiving_date,
      sample_size,
      sample_type,
      species,
      extraction_needed,
      extraction_status,
      storage_unit,
      storage_condition,
      library_type,
      library_status,
      library_date,
      pcr_type,
      run_facility,
      run_status,
      run_date,
      srf_link,
      notes,
    } = req.body;

    await db.query(
      `UPDATE projects SET 
        project_type = COALESCE(?, project_type),
        project_description = COALESCE(?, project_description),
        client_name = COALESCE(?, client_name),
        sample_receiving_date = COALESCE(?, sample_receiving_date),
        sample_size = COALESCE(?, sample_size),
        sample_type = COALESCE(?, sample_type),
        species = COALESCE(?, species),
        extraction_needed = COALESCE(?, extraction_needed),
        extraction_status = COALESCE(?, extraction_status),
        storage_unit = COALESCE(?, storage_unit),
        storage_condition = COALESCE(?, storage_condition),
        library_type = COALESCE(?, library_type),
        library_status = COALESCE(?, library_status),
        library_date = COALESCE(?, library_date),
        pcr_type = COALESCE(?, pcr_type),
        run_facility = COALESCE(?, run_facility),
        run_status = COALESCE(?, run_status),
        run_date = COALESCE(?, run_date),
        srf_link = COALESCE(?, srf_link),
        notes = COALESCE(?, notes),
        updated_at = NOW()
      WHERE id = ?`,
      [
        project_type,
        project_description,
        client_name,
        sample_receiving_date,
        sample_size,
        sample_type,
        species,
        extraction_needed,
        extraction_status,
        storage_unit,
        storage_condition,
        library_type,
        library_status,
        library_date,
        pcr_type,
        run_facility,
        run_status,
        run_date,
        srf_link,
        notes,
        id,
      ]
    );

    res.json({ success: true, message: "Project updated" });
  } catch (error) {
    console.error("Update project error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update project",
    });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    await db.query("DELETE FROM projects WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Project deleted" });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({ success: false });
  }
};

/* ===== RUN PLANS ===== */

exports.createRunPlan = async (req, res) => {
  try {
    const { project_id, unique_run_id, run_date } = req.body;
    if (!unique_run_id) {
      return res
        .status(400)
        .json({ success: false, message: "Run ID required" });
    }

    const [result] = await db.query(
      `INSERT INTO run_plans (project_id, unique_run_id, run_date, created_by) VALUES (?,?,?,?)`,
      [project_id, unique_run_id, run_date, req.userId]
    );

    res.status(201).json({ success: true, runId: result.insertId });
  } catch (error) {
    console.error("Create run plan error:", error);
    res.status(500).json({ success: false });
  }
};

exports.getRunPlans = async (req, res) => {
  try {
    const [runs] = await db.query(`
      SELECT r.*, 
             p.project_type,
             p.client_name,
             p.project_description
      FROM run_plans r
      LEFT JOIN projects p ON r.project_id = p.id
      ORDER BY r.run_date DESC
    `);
    res.json({ success: true, count: runs.length, runs });
  } catch (error) {
    console.error("Get run plans error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ===== REPORTS ===== */

exports.getInventoryReport = async (req, res) => {
  try {
    const [[labStats]] = await db.query(`
      SELECT COUNT(*) as total, SUM(current_stock) as total_stock,
             SUM(CASE WHEN reorder_status='REORDER_REQUIRED' THEN 1 ELSE 0 END) as reorder_needed
      FROM lab_inventory
    `);

    const [[ngsStats]] = await db.query(`
      SELECT COUNT(*) as total, SUM(quantity_in_stock) as total_stock,
             SUM(CASE WHEN reorder_status='REORDER_REQUIRED' THEN 1 ELSE 0 END) as reorder_needed
      FROM ngs_inventory
    `);

    const [[alertStats]] = await db.query(`
      SELECT COUNT(*) as total_alerts,
             SUM(CASE WHEN severity='CRITICAL' THEN 1 ELSE 0 END) as critical_alerts
      FROM inventory_alerts WHERE is_resolved=FALSE
    `);

    res.json({
      success: true,
      report: {
        lab_inventory: labStats,
        ngs_inventory: ngsStats,
        alerts: alertStats,
      },
    });
  } catch (error) {
    console.error("Get report error:", error);
    res.status(500).json({ success: false });
  }
};
