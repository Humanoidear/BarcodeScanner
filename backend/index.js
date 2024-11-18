const express = require('express');
const fs = require('fs');
const https = require('https');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require('body-parser');
const pgp = require('pg-promise')();
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const db = pgp({ connectionString: process.env.DATABASE_URL });
const redirectURL = process.env.REDIRECT_URL;

const app = express();
const port = process.env.PORT || 443;

https.createServer({
    cert: fs.readFileSync('danascan.cert'),
    key: fs.readFileSync('danascan.key')
}, app).listen(port, function() {
    console.log(`Servidor https corriendo en el puerto ${port}`);
});

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../frontend/dist")));
app.use(helmet());
app.use(helmet.hsts({
    maxAge: 300,
    includeSubDomains: true,
    preload: true
}));

app.post('/upload', async (req, res) => {
    const form = req.body;
    console.log(form);
    try {
        const isValid = await verifyCode(form.code);
        if (isValid) {
            const isMain = await db.oneOrNone('SELECT id FROM centro WHERE id = $1 AND ismain = true', [form.quantity]);
            console.log(isMain);

            if (isMain) {
                // Ensure that there exists at least one fulfilled record with the same lectura value
                const isFulfilled = await db.any('SELECT 1 FROM reparto WHERE lectura = $1 AND fulfilled = 1', [form.barcode]);
                if (isFulfilled.length > 0) {
                    await db.none(`
                        UPDATE reparto 
                        SET fulfilled = 2
                        WHERE id = (
                            SELECT id 
                            FROM reparto 
                            WHERE lectura = $1
                            AND fulfilled = 1
                            ORDER BY id ASC 
                            LIMIT 1
                        )
                    `, [form.barcode]);
                    res.redirect(redirectURL + '/?message=Palet eliminado enviado a reparto');
                } else {
                    res.redirect(redirectURL + '/?message=No se encuentra este palet en la base de datos, simula un palet recibido para enviar');
                }
            } else {
                await db.none('INSERT INTO reparto (lectura, timestamp, almacen) VALUES ($1, $2, $3)', [form.barcode, form.timestamp, form.quantity]);
                res.redirect(redirectURL + '/?message=Palet recibido y almacenado en la base de datos');
            }
        } else {
            res.redirect(redirectURL + '/?message=Código de verificación inválido o expirado');
        }
    } catch (error) {
        console.error('Error processing request:', error);
        res.redirect(redirectURL + '/?message=Error procesando la solicitud');
    }
});

app.post('/simular-palet', async (req, res) => {
    const form = req.body;
    try {
        const isValid = await verifyCode(form.code);
        if (isValid) {
            await db.none('INSERT INTO reparto (lectura, timestamp, almacen, fulfilled, timestamp_recepcion, issimulated) VALUES ($1, NOW(), $2, 1, NOW(), true)', [form.barcode, form.almacen]);
            res.json({ status: 'success' });
        } else {
            res.redirect(redirectURL + '/?message=Código de verificación inválido o expirado');
        }
    } catch (error) {
        console.error('Error processing request:', error);
        res.json({ status: 'error' });
    }
});

app.post('/afegir-centre', (req, res) => {
    const form = req.body;
    verifyCodeAdmin(form.code)
        .then(isValid => {
            if (isValid) {
                db.none('INSERT INTO centro (centro) VALUES ($1)', [form.name])
                    .then(() => {
                        console.log('Data sent to the database');
                        res.redirect(redirectURL + '/admin?message=Centro añadido con éxito');
                    })
                    .catch(error => {
                        console.error('Error sending data to the database', error);
                        res.redirect(redirectURL + '/admin?message=Error al añadir el centro');
                    });
            } else {
                res.redirect(redirectURL + '/admin?message=Error: Código de verificación inválido o expirado');
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.redirect(redirectURL + '/admin?message=Error al verificar el código de verificación');
        });
});

app.get('/afegir-centre', (req, res) => {
    db.any('SELECT * FROM centro')
        .then(data => {
            console.log('Data received from the database');
            res.json(data);
        })
        .catch(error => {
            console.error('Error receiving data from the database', error);
            res.status(500).json({ message: 'Error al recibir datos de la base de datos' });
        });
});

app.post('/esborrar-centre', (req, res) => {
    const form = req.body;
    verifyCodeAdmin(form.code)
        .then(isValid => {
            if (isValid) {
                db.none('DELETE FROM centro WHERE id = $1', [form.delete])
                    .then(() => {
                        console.log('Data sent to the database');
                        res.redirect(redirectURL + '/admin?message=Centro eliminado con éxito');
                    })
                    .catch(error => {
                        console.error('Error sending data to the database', error);
                        res.redirect(redirectURL + '/admin?message=Error al eliminar el centro');
                    });
            } else {
                res.redirect(redirectURL + '/admin?message=Error: Código de verificación inválido o expirado');
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.redirect(redirectURL + '/admin?message=Error al verificar el código de verificación');
        });
});

app.post('/verificar', async (req, res) => {
    const form = req.body;

    try {
        // Fetch the product name associated with the barcode
        const product = await db.oneOrNone('SELECT articulo FROM articulos WHERE lectura = $1', [form.barcode]);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        // Fetch the warehouse name associated with the almacen
        const warehouse = await db.oneOrNone('SELECT centro FROM centro WHERE id = $1', [form.almacen]);
        if (!warehouse) {
            return res.status(404).json({ message: 'Almacén no encontrado' });
        }

        // Fetch the records from the reparto table
        const data = await db.any(`
            SELECT r.id, r.lectura, a.articulo AS lectura_nombre, c.centro AS almacen, r.timestamp, r.fulfilled, r.timestamp_recepcion
            FROM reparto r
            JOIN centro c ON r.almacen = c.id
            JOIN articulos a ON r.lectura = a.lectura
            WHERE r.lectura = $1 AND r.almacen = $2
        `, [form.barcode, form.almacen]);

        // Return the response with the product name, warehouse name, and data
        res.json({
            product: product.articulo,
            warehouse: warehouse.centro,
            data: data
        });
    } catch (error) {
        console.error('Error receiving data from the database', error);
        res.status(500).json({ message: 'Error al recibir datos de la base de datos' });
    }
});

app.post('/afegir-article', (req, res) => {
    const form = req.body;
    verifyCodeAdmin(form.code)
        .then(isValid => {
            if (isValid) {
                // Check if the lectura value already exists
                db.oneOrNone('SELECT 1 FROM articulos WHERE lectura = $1', [form.barcode])
                    .then(existing => {
                        if (existing) {
                            res.redirect(redirectURL + '/?message=Error: El código de barras ya existe');
                        } else {
                            db.none('INSERT INTO articulos (lectura, articulo) VALUES ($1, $2)', [form.barcode, form.article])
                                .then(() => {
                                    console.log('Data sent to the database');
                                    res.redirect(redirectURL + '/admin?message=Artículo añadido con éxito');
                                })
                                .catch(error => {
                                    console.error('Error sending data to the database', error);
                                    res.redirect(redirectURL + '/admin?message=Error al añadir el artículo');
                                });
                        }
                    })
                    .catch(error => {
                        console.error('Error checking existing data in the database', error);
                        res.redirect(redirectURL + '/admin?message=Error al verificar el código de barras');
                    });
            } else {
                res.redirect(redirectURL + '/admin?message=Error: Código de verificación inválido o expirado');
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.redirect(redirectURL + '/?message=Error al verificar el código de verificación');
        });
});

app.get('/afegir-article', (req, res) => {
    db.any('SELECT * FROM articulos')
        .then(data => {
            console.log('Data received from the database');
            res.json(data);
            console.log(data);
        })
        .catch(error => {
            console.error('Error receiving data from the database', error);
            res.status(500).json({ message: 'Error al recibir datos de la base de datos' });
        });
});

app.post('/verificar-article', (req, res) => {
    const form = req.body;
    db.any('SELECT * FROM articulos WHERE lectura = $1', [form.barcode])
        .then(data => {
            console.log('Data received from the database');
            res.json(data);
        })
        .catch(error => {
            console.error('Error receiving data from the database', error);
            res.status(500).json({ message: 'Error al recibir datos de la base de datos' });
        });
});

app.post('/esborrar-article', (req, res) => {
    const form = req.body;
    verifyCodeAdmin(form.code)
        .then(isValid => {
            if (isValid) {
                db.none('DELETE FROM articulos WHERE id = $1', [form.delete])
                    .then(() => {
                        console.log('Data sent to the database');
                        res.redirect(redirectURL + '/admin?message=Artículo eliminado con éxito');
                    })
                    .catch(error => {
                        console.error('Error sending data to the database', error);
                        res.redirect(redirectURL + '/admin?message=Error al eliminar el artículo');
                    });
            } else {
                res.redirect(redirectURL + '/admin?message=Error: Código de verificación inválido o expirado');
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.redirect(redirectURL + '/admin?message=Error al verificar el código de verificación');
        });
});


app.get('/verificar-article', (req, res) => {
    db.any('SELECT * FROM articulos')
        .then(data => {
            console.log('Data received from the database');
            res.json(data);
        })
        .catch(error => {
            console.error('Error receiving data from the database', error);
            res.status(500).json({ message: 'Error al recibir datos de la base de datos' });
        });
});

app.post('/esborrar-palet', (req, res) => {
    const form = req.body;
    console.log(form);
    verifyCode(form.code)
        .then(isValid => {
            if (isValid) {
                db.none('DELETE FROM reparto WHERE id = $1', [form.id])
                    .then(() => {
                        console.log('Data deleted from the database');
                        res.json({ message: 1 });
                    })
                    .catch(error => {
                        console.error('Error deleting data from the database', error);
                        res.redirect(redirectURL + '/?message=Error al eliminar el palet');
                    });
            } else {
                res.json({ message: 0 });
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.redirect(redirectURL + '/?message=Error al verificar el código de verificación');
        });
});

app.post('/acceptar-palet', async (req, res) => {
    const form = req.body;
    try {
        const isValid = await verifyCode(form.code);
        if (isValid) {
            // Find the row with the lowest id that can be updated
            const row = await db.oneOrNone(`
                SELECT id 
                FROM reparto 
                WHERE almacen = $1
                AND lectura = $2
                AND fulfilled = 0
                ORDER BY id ASC 
                LIMIT 1
            `, [form.almacen, form.product]);

            if (row) {
                // Update the found row to fulfilled = 1
                await db.none('UPDATE reparto SET fulfilled = 1, timestamp_recepcion = NOW() WHERE id = $1', [row.id]);
                console.log('Data updated in the database');
                res.json({ message: 1 });
            } else {
                // If no such row exists, return an error message
                res.status(400).json({ message: 'No rows found that can be updated' });
            }
        } else {
            res.json({ message: 0 });
        }
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ message: 'Error al aceptar el palet' });
    }
});

app.post('/codi-expirat', (req, res) => {
    const form = req.body;
    // If the code is empty, return true
    if (!form.code) {
        console.log('Code not found');
        res.json({ expired: true });
        return;
    }
    // Ensure the code is an integer and within the valid range for a 32-bit integer
    const code = parseInt(form.code, 10);
    if (isNaN(code) || code < -2147483648 || code > 2147483647) {
        console.log('Code not found or out of range');
        res.json({ expired: true });
        return;
    }
    // Return the expiration date of the code, select from the first and only row
    db.oneOrNone('SELECT expiración FROM codigo WHERE codigo = $1', [code])
        .then(data => {
            // Check if it exists
            if (data) {
                // Check if the expiration date is in the past
                if (new Date(data.expiración) < new Date()) {
                    console.log('Code expired');
                    res.json({ expired: true });
                } else {
                    console.log('Code not expired');
                    res.json({ expired: false });
                }
            } else {
                console.log('Code not found');
                res.json({ expired: true });
            }
        })
        .catch(error => {
            console.error('Error receiving data from the database', error);
            res.status(500).json({ message: 'Error al recibir datos de la base de datos' });
        });
});

function verifyCode(code) {
    // Check if the code is null or not a number
    if (!code || isNaN(parseInt(code, 10))) {
        console.log('Code not found or invalid');
        return Promise.resolve(false);
    }

    // Fetch code and expiration date from the database
    return db.oneOrNone('SELECT codigo, expiración FROM codigo WHERE codigo = $1', [code])
        .then(data => {
            // If the code exists and is not expired, return true
            if (data && new Date(data.expiración) > new Date()) {
                console.log('Code verified');
                return true;
            } else {
                console.log('Code verification failed');
                return false;
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            return false;
        });
}

app.post('/filtrar', (req, res) => {
    const form = req.body;
    console.log(form);

    let before = form.before ? new Date(form.before) : null;
    if (before) {
        before.setHours(24, 0, 0, 0);
    }

    let after = form.after ? new Date(form.after) : null;
    if (after) {
        after.setHours(0, 0, 0, 0);
    }

    // Verify the admin code
    verifyCodeAdmin(form.code)
        .then(isValid => {
            if (isValid) {
                const query = `
                    SELECT r.id, r.lectura, a.articulo AS lectura_nombre, c.centro AS almacen, r.timestamp, r.fulfilled, r.timestamp_recepcion
                    FROM reparto r
                    JOIN centro c ON r.almacen = c.id
                    JOIN articulos a ON r.lectura = a.lectura
                    WHERE ($1::int IS NULL OR a.id = $1::int)
                    AND (
                        $2::int IS NULL 
                        OR r.almacen = $2::int
                        OR ($2::int IS NULL AND r.fulfilled IN (0, 1))
                    )
                    AND (
                        $3::int IS NULL 
                        OR (r.fulfilled = $3::int)
                        OR ($3::int IS NULL AND r.fulfilled IN (0, 1))
                    )
                    AND ($4::date IS NULL OR r.timestamp >= $4)
                    AND ($5::date IS NULL OR r.timestamp <= $5)
                `;
                const params = [
                    form.product ? parseInt(form.product, 10) : null,
                    form.warehouse ? parseInt(form.warehouse, 10) : null,
                    form.status ? parseInt(form.status, 10) : null,
                    after,
                    before
                ];

                db.any(query, params)
                    .then(data => {
                        console.log('Data received from the database');
                        res.json(data);
                    })
                    .catch(error => {
                        console.error('Error receiving data from the database', error);
                        res.status(500).json({ message: 'Error al recibir datos de la base de datos' });
                    });
            } else {
                res.status(403).json({ message: 'Código de verificación inválido o expirado' });
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.status(500).json({ message: 'Error al verificar el código de verificación' });
        });
});

// ADMIN
app.post('/codi-expirat-admin', (req, res) => {
    const form = req.body;
    const code = form.code;
    if (!code) {
        console.log('Code not found');
        res.json({ expired: true });
        return;
    }

    // Return the expiration date of the code, select from the first and only row
    db.oneOrNone('SELECT expiración FROM codigoadmin WHERE codigo = $1', [code])
        .then(data => {
            // Check if it exists
            if (data) {
                // Check if the expiration date is in the past
                if (new Date(data.expiración) < new Date()) {
                    console.log('Code expired');
                    res.json({ expired: true });
                } else {
                    console.log('Code not expired');
                    res.json({ expired: false });
                }
            } else {
                console.log('Code not found');
                res.json({ expired: true });
            }
        })
        .catch(error => {
            console.error('Error receiving data from the database', error);
            res.status(500).json({ message: 'Error al recibir datos de la base de datos' });
        });
});

app.post('/canviar-mot-de-pas', (req, res) => {
    const form = req.body;
    verifyCodeAdmin(form.code)
        .then(isValid => {
            if (isValid) {
                // Set expiration to midnight if it is empty
                let expiration = form.expiration;
                console.log(form);
                if (!expiration || expiration == '') {
                    console.log('Expiration not found');
                    const today = new Date();
                    expiration = new Date(today.setHours(24, 0, 0, 0)).toISOString();
                }
                console.log(expiration);

                // Change the password in codigo table, set all to expired (Expiración is set to NOW()) and create a new code with the new password and a new expiration date
                db.tx(t => {
                    return t.batch([
                        t.none("UPDATE codigo SET expiración = NOW() WHERE expiración::timestamp > NOW()"),
                        t.none('INSERT INTO codigo (codigo, expiración) VALUES ($1, $2)', [form.password, expiration])
                    ]);
                })
                    .then(() => {
                        console.log('Password changed');
                        res.redirect(redirectURL + '/admin?message=Contraseña cambiada con éxito');
                    })
                    .catch(error => {
                        console.error('Error changing password:', error);
                        res.redirect(redirectURL + '/admin?message=Error al cambiar la contraseña');
                    });
            } else {
                res.redirect(redirectURL + '/admin?message=Error: Código de verificación inválido o expirado');
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.redirect(redirectURL + '/admin?message=Error al verificar el código de verificación');
        });
});

app.post('/codi-en-vigor', (req, res) => {
    const form = req.body;
    verifyCodeAdmin(form.code)
        .then(isValid => {
            if (isValid) {
                db.oneOrNone('SELECT codigo, expiración FROM codigo WHERE expiración::timestamp > NOW()')
                    .then(data => {
                        if (data) {
                            res.json({ data: { code: data.codigo, expiration: data.expiración } });
                        } else {
                            res.json({ message: 'No active code found' });
                        }
                    })
                    .catch(error => {
                        console.error('Error verifying code:', error);
                        res.status(500).json({ message: 'Error al verificar el código de verificación' });
                    });
            } else {
                res.redirect(redirectURL + '/admin?message=Error: Código de verificación inválido o expirado');
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.redirect(redirectURL + '/admin?message=Error al verificar el código de verificación');
        });
});

function verifyCodeAdmin(code) {
    if (!code) {
        console.log('Code not found');
        return false;
    }

    // Fetch code and expiration date from the database
    return db.oneOrNone('SELECT codigo, expiración FROM codigoadmin WHERE codigo = $1', [code])
        .then(data => {
            // If the code exists and is not expired, return true
            if (data && new Date(data.expiración) > new Date()) {
                console.log('Code verified');
                return true;
            } else {
                console.log('Code verification failed');
                return false;
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            return false;
        });
}

app.post('/afegir-palet-manual', async (req, res) => {
    const form = req.body;
    try {
        const isValid = await verifyCodeAdmin(form.code);
        if (isValid) {
            // Fetch the corresponding lectura value from the articulos table
            const articulo = await db.oneOrNone('SELECT lectura FROM articulos WHERE id = $1', [form.product]);
            if (articulo) {
                for (let i = 0; i < form.quantity; i++) {
                    await db.none('INSERT INTO reparto (lectura, timestamp, almacen, fulfilled, timestamp_recepcion, issimulated) VALUES ($1, NOW(), $2, 1, NOW(), true)', [articulo.lectura, form.warehouse]);
                }
                res.redirect(redirectURL + '/admin?message=Palets añadidos correctamente');
            } else {
                res.redirect(redirectURL + '/admin?message=Producto no encontrado');
            }
        } else {
            res.redirect(redirectURL + '/admin?message=Código de verificación inválido o expirado');
        }
    } catch (error) {
        console.error('Error processing request:', error);
        res.redirect(redirectURL + '/admin?message=Error al procesar la solicitud');
    }
});

app.post('/esborrar-palet-manual', async (req, res) => {
    const form = req.body;
    if (form.quantity != null && form.quantity !== "") {
        try {
            const isValid = await verifyCodeAdmin(form.code);
            if (isValid) {
                for (let i = 0; i < form.quantity; i++) {
                    await db.none(`
                        DELETE FROM reparto 
                        WHERE id = (
                            SELECT id 
                            FROM reparto 
                            WHERE lectura = $1 
                            ORDER BY id ASC 
                            LIMIT 1
                        )
                    `, [form.delete]);
                }
                if (form.quantity == 1) {
                    res.redirect(redirectURL + '/admin?message=Palet eliminado correctamente');
                } else {
                    res.redirect(redirectURL + '/admin?message=Palets eliminados correctamente');
                }
            } else {
                res.redirect(redirectURL + '/admin?message=Código de verificación inválido o expirado');
            }
        } catch (error) {
            console.error('Error processing request:', error);
            res.redirect(redirectURL + '/admin?message=Error al procesar la solicitud');
        }
    } else {
        res.redirect(redirectURL + '/admin?message=Selecciona un palet primero');
    }
});

// Start the server
//app.listen(port, () => {
//    console.log(`Server is running on http://localhost:${port}`);
//});
