# Moon Order Manager

Quiero que construyas una aplicación web responsiva, privada y completamente funcional para mi negocio llamado “Cookies Moon”.

La aplicación será utilizada únicamente por tres personas del negocio para registrar, organizar, producir, cobrar, enviar y finalizar pedidos desde computadora, celular o tablet.

Utiliza:

Lovable para la interfaz y lógica de la aplicación.

Supabase Auth para autenticación.

Supabase Database para almacenar la información.

Supabase Storage para imágenes y archivos.

Row Level Security para proteger todos los datos.

Actualización de datos entre dispositivos y usuarios.

No quiero solamente una demostración visual. Quiero una aplicación funcional, conectada a Supabase y preparada para utilizarse con datos reales.

OBJETIVO PRINCIPAL

La aplicación debe permitir:

Registrar pedidos.

Guardar clientes.

Administrar productos.

Cargar imágenes de productos.

Registrar productos personalizados.

Registrar muchos productos al mismo tiempo.

Consultar imágenes rápidamente durante la fabricación.

Añadir notas con imágenes.

Controlar el avance de producción artículo por artículo.

Registrar pagos y abonos.

Controlar saldos pendientes.

Organizar pedidos por estado.

Consultar entregas y envíos.

Revisar el historial de cambios.

Acceder desde celular, tablet y computadora.

ACCESO Y USUARIOS

La aplicación será privada.

No debe existir registro público de usuarios.

Solamente podrán acceder usuarios previamente autorizados mediante correo electrónico y contraseña.

Crear dos roles:

Administrador.

Colaborador.

Permisos del administrador

El administrador puede:

Crear, editar y desactivar usuarios.

Administrar productos.

Administrar imágenes.

Administrar pedidos.

Registrar pagos.

Cambiar estados.

Modificar la tabla de precios de cortadores.

Consultar reportes.

Revisar el historial de actividad.

Importar productos en masa.

Eliminar datos de demostración.

Modificar configuraciones generales.

Permisos del colaborador

El colaborador puede:

Crear pedidos.

Editar pedidos.

Registrar clientes.

Registrar productos.

Subir imágenes.

Añadir notas.

Registrar pagos.

Cambiar estados de pedidos.

Marcar artículos como terminados.

Consultar información.

Los colaboradores no pueden:

Crear usuarios.

Modificar permisos.

Modificar la tabla general de precios de cortadores.

Eliminar definitivamente información importante.

NAVEGACIÓN PRINCIPAL

Crear las siguientes secciones:

Panel general.

Nuevo pedido.

Pedidos.

Productos.

Clientes.

Importaciones.

Configuración.

En computadora utilizar un menú lateral.

En celular y tablet utilizar una navegación inferior responsiva con botones grandes.

Mantener siempre visible un botón destacado llamado:

“Nuevo pedido”.

DISEÑO VISUAL

Crear un diseño profesional, moderno, elegante y fácil de usar.

Utilizar un tema oscuro para proteger la vista.

Colores principales:

Fondo principal: #0F1117.

Paneles y tarjetas: #181C25.

Campos: #222734.

Texto principal: #F4F6FA.

Texto secundario: #AAB1C0.

Colores de categorías:

Cortadores: #FF8A3D.

Stencils: #C86BFA.

Cajas: #35C4D8.

Otros: #F5C451.

Colores de estados:

En espera: #9CA3AF.

En preparación: #8B5CF6.

Enviado: #3B82F6.

Finalizado: #22C55E.

Pausado: #F59E0B.

Cancelado: #EF4444.

No depender solamente del color.

Utilizar también:

Etiquetas.

Íconos.

Texto.

Barras de progreso.

Miniaturas.

Estados visibles.

Botones grandes.

Checks fáciles de presionar.

Toda la aplicación debe funcionar correctamente con los dedos desde celular y tablet.

La aplicación debe sentirse diseñada específicamente para Cookies Moon y no como una plantilla administrativa genérica.

CATEGORÍAS DE PRODUCTOS

La aplicación manejará cuatro categorías:

CORTADORES.

STENCILS.

CAJAS.

OTROS.

CATÁLOGO DE PRODUCTOS

Crear una sección de productos con vista de tarjetas y vista de tabla.

Cada producto debe tener:

ID.

Código o SKU único.

Nombre.

Categoría.

Precio base cuando corresponda.

Descripción opcional.

Notas de fabricación.

Imagen principal.

Galería de imágenes adicionales.

Estado activo o inactivo.

Fecha de creación.

Fecha de actualización.

Usuario que lo creó.

Permitir:

Crear productos.

Editar productos.

Duplicar productos.

Buscar productos.

Filtrar por categoría.

Cambiar precios.

Cambiar categorías.

Añadir notas.

Subir imágenes.

Reordenar imágenes.

Elegir una imagen principal.

Activar productos.

Desactivar productos.

Consultar cuántas veces se ha vendido un producto.

No eliminar definitivamente productos que ya estén relacionados con pedidos.

En esos casos, solamente marcarlos como inactivos.

IMÁGENES DE PRODUCTOS

Cada producto puede tener una o varias imágenes.

Las imágenes pueden ser:

Imagen del diseño.

Fotografía del producto terminado.

Diseño del cortador.

Diseño del stencil.

Boceto.

Referencia.

Imagen enviada por un cliente.

Ejemplo de fabricación.

Instrucción visual.

Permitir:

Subir imágenes.

Eliminar imágenes.

Reordenarlas.

Elegir la principal.

Abrirlas en una galería.

Ampliarlas.

Verlas en tamaño completo.

Descargarlas para consulta interna.

Las imágenes deben guardarse en Supabase Storage privado.

FUNCIONAMIENTO ESPECIAL DE CORTADORES

Los productos de la categoría CORTADORES no tendrán un precio fijo dentro del catálogo.

El producto representará solamente el diseño.

Ejemplos:

Muñeco de nieve.

Corazón.

Nombre personalizado.

Personaje.

Flor.

Logotipo.

Cuando se cree o edite un producto de la categoría CORTADORES, solicitar:

SKU.

Nombre del diseño.

Categoría.

Descripción.

Notas de fabricación.

Imagen principal.

Imágenes adicionales.

Estado activo o inactivo.

No mostrar un campo de precio.

Mostrar en su lugar:

“Precio automático según modalidad y tamaño”.

Para las categorías STENCILS, CAJAS y OTROS, el campo precio sí será obligatorio.

MODALIDADES DE CORTADORES

Los cortadores pueden venderse en dos modalidades:

Solo cortador.

Cortador con sello.

Un mismo diseño puede venderse en diferentes tamaños y modalidades sin registrarlo varias veces en el catálogo.

Ejemplo:

El producto “Muñeco de nieve” puede utilizarse como:

Solo cortador de 5 cm.

Solo cortador de 10 cm.

Cortador con sello de 8 cm.

Cortador con sello de 15 cm.

TABLA DE PRECIOS DE SOLO CORTADOR

Utilizar exactamente estos precios iniciales:

5 cm: $25.

6 cm: $30.

7 cm: $33.

8 cm: $35.

9 cm: $40.

10 cm: $45.

11 cm: $50.

12 cm: $55.

13 cm: $60.

14 cm: $65.

15 cm: $70.

16 cm: $75.

17 cm: $80.

18 cm: $85.

19 cm: $90.

20 cm: $95.

TABLA DE PRECIOS DE CORTADOR CON SELLO

Utilizar exactamente estos precios iniciales:

5 cm con sello: $50.

6 cm con sello: $55.

7 cm con sello: $60.

8 cm con sello: $70.

9 cm con sello: $80.

10 cm con sello: $90.

11 cm con sello: $100.

12 cm con sello: $110.

13 cm con sello: $120.

14 cm con sello: $135.

15 cm con sello: $145.

16 cm con sello: $155.

17 cm con sello: $165.

18 cm con sello: $180.

19 cm con sello: $190.

20 cm con sello: $220.

CONFIGURACIÓN DE PRECIOS DE CORTADORES

Dentro de Configuración, crear una sección llamada:

“Precios de cortadores”.

Esta sección solamente podrá ser utilizada por el administrador.

Mostrar una tabla con:

Modalidad.

Tamaño.

Precio actual.

Fecha de última modificación.

Usuario que modificó el precio.

Permitir modificar los precios en el futuro sin cambiar el código.

Antes de guardar una modificación, mostrar:

Precio anterior.

Precio nuevo.

Diferencia.

Confirmación.

Los cambios solamente afectarán pedidos nuevos.

Los pedidos anteriores deben conservar el precio aplicado cuando fueron creados.

REGISTRO MASIVO DE PRODUCTOS

En la sección Productos, agregar dos botones:

Importar productos en masa.

Captura rápida.

El objetivo es registrar muchos productos sin tener que crearlos uno por uno.

IMPORTACIÓN MEDIANTE EXCEL O CSV

Permitir descargar una plantilla en formato XLSX y CSV.

La plantilla debe incluir:

SKU.

Nombre del producto.

Categoría.

Precio.

Descripción.

Notas de fabricación.

Nombre de la imagen principal.

Nombres de imágenes adicionales.

Estado activo o inactivo.

Categorías válidas:

CORTADORES.

STENCILS.

CAJAS.

OTROS.

Ejemplos de SKU:

COR-0001.

STE-0001.

CAJ-0001.

OTR-0001.

Si el usuario no incluye un SKU, generar uno automáticamente según la categoría.

Reglas de precios en importaciones

Para CORTADORES:

No solicitar precio.

Ignorar cualquier precio incluido accidentalmente.

Mostrar “Precio automático según modalidad y tamaño”.

Para STENCILS, CAJAS y OTROS:

El precio es obligatorio.

El precio debe ser igual o mayor a cero.

FLUJO DE IMPORTACIÓN

Crear un asistente con estos pasos:

Descargar plantilla.

Seleccionar archivo XLSX o CSV.

Leer los datos.

Relacionar columnas.

Validar información.

Mostrar vista previa.

Corregir errores.

Confirmar importación.

Mostrar resumen final.

Antes de importar, mostrar:

Total de filas.

Productos nuevos.

Productos existentes.

Filas correctas.

Filas con errores.

Productos duplicados.

Productos sin imágenes.

Productos sin precio cuando sea obligatorio.

Mostrar los errores por fila y columna.

Ejemplos:

Categoría no válida.

Precio obligatorio.

SKU duplicado.

Nombre vacío.

Formato de precio incorrecto.

Imagen no encontrada.

Permitir descargar un archivo con los errores para corregirlo y volverlo a importar.

PRODUCTOS DUPLICADOS

Cuando un SKU ya exista, permitir elegir:

Omitir el producto.

Actualizar el producto existente.

Crear una copia con un nuevo SKU.

No crear duplicados silenciosamente.

Antes de actualizar productos existentes, solicitar confirmación.

IMPORTACIÓN MASIVA DE IMÁGENES

Después de cargar el Excel o CSV, permitir subir un archivo ZIP con imágenes.

Relacionar las imágenes mediante el SKU.

Ejemplos:

COR-0001-1.jpg.

COR-0001-2.jpg.

COR-0001-3.png.

STE-0025-1.jpg.

La primera imagen se puede establecer automáticamente como principal.

Las demás se guardarán en la galería.

También permitir incluir imágenes mediante URL.

Para varias imágenes por URL, utilizar el carácter:

|

Ejemplo:

https://imagen1.jpg|https://imagen2.jpg|https://imagen3.jpg

Si una imagen no puede relacionarse con ningún producto, mostrarla en:

“Imágenes sin producto relacionado”.

No eliminar ni ignorar imágenes sin avisar.

CAPTURA RÁPIDA EN TABLA

Crear una pantalla similar a una hoja de cálculo.

Permitir:

Agregar varias filas.

Copiar y pegar desde Excel.

Editar celdas.

Duplicar filas.

Eliminar filas.

Aplicar una categoría a varias filas.

Aplicar un precio a varias filas.

Aplicar las mismas notas a varias filas.

Subir imágenes.

Guardar todos los productos juntos.

Columnas:

SKU.

Nombre.

Categoría.

Precio.

Descripción.

Notas.

Imagen principal.

Estado.

Si la categoría es CORTADORES:

Desactivar el precio.

Mostrar “Precio automático según tamaño”.

No permitir capturar precio manual.

Si la categoría es STENCILS, CAJAS u OTROS:

Mostrar precio.

Hacerlo obligatorio.

Antes de guardar, validar todas las filas.

Permitir:

Guardar solamente las filas correctas.

Cancelar toda la operación.

Corregir las filas con errores.

HISTORIAL DE IMPORTACIONES

Registrar:

Usuario.

Fecha.

Hora.

Archivo.

Total de filas.

Productos creados.

Productos actualizados.

Productos omitidos.

Errores.

Estado de la importación.

Crear una sección donde el administrador pueda consultar importaciones anteriores.

NUEVO PEDIDO

El formulario de nuevo pedido debe dividirse en estos pasos:

Cliente.

Tipo de entrega.

Productos.

Notas e imágenes.

Pago.

Confirmación.

Guardar automáticamente el pedido como borrador mientras se llena el formulario.

DATOS DEL CLIENTE

Solicitar:

Nombre.

Apellidos.

Número de teléfono.

Medio de contacto.

Medios de contacto:

WhatsApp.

Facebook.

Instagram.

Tienda en línea.

Recomendación.

Otro.

Antes de crear un cliente, buscar coincidencias por número telefónico.

Si el cliente ya existe, permitir:

Seleccionarlo.

Recuperar sus datos.

Recuperar sus direcciones.

Consultar pedidos anteriores.

Consultar saldos pendientes.

Actualizar información.

TIPO DE ENTREGA

Crear dos opciones:

Envío.

Entrega personal.

Cuando sea envío

Solicitar:

Nombre.

Apellidos.

Teléfono.

Calle.

Número exterior.

Número interior opcional.

Colonia.

Municipio o alcaldía.

Ciudad.

Estado.

Código postal.

Referencias del domicilio.

Indicaciones especiales.

Paquetería.

Costo del envío.

Fecha estimada de envío.

Número de guía opcional.

Imagen opcional de la guía o comprobante.

Cuando sea entrega personal

Solicitar:

Nombre.

Apellidos.

Teléfono.

Lugar de entrega.

Fecha de entrega.

Hora aproximada.

Indicaciones adicionales.

PRODUCTOS DENTRO DEL PEDIDO

Un pedido puede contener varios productos y mezclar diferentes categorías.

Para cada artículo permitir:

Elegir categoría.

Elegir producto.

Indicar cantidad.

Mostrar precio unitario.

Calcular subtotal.

Añadir especificaciones.

Añadir notas.

Subir imágenes personalizadas.

Al final del selector mostrar:

“+ Agregar producto nuevo”.

Al seleccionarlo, abrir un formulario rápido con:

Nombre.

Categoría.

Precio cuando corresponda.

Descripción.

Notas de fabricación.

Imagen principal.

Imágenes adicionales.

Opción para guardar permanentemente en el catálogo.

Después de crearlo, seleccionarlo automáticamente en el pedido.

Si el producto nuevo es CORTADOR:

No pedir precio.

Mostrar “Precio automático según modalidad y tamaño”.

SELECCIÓN DE CORTADORES EN UN PEDIDO

Cuando se seleccione la categoría CORTADORES, mostrar los campos en este orden:

Diseño o producto.

Modalidad.

Tamaño.

Cantidad.

Precio unitario automático.

Subtotal.

Notas.

Imágenes personalizadas.

Modalidades:

Solo cortador.

Cortador con sello.

Tamaños:

5 cm.

6 cm.

7 cm.

8 cm.

9 cm.

10 cm.

11 cm.

12 cm.

13 cm.

14 cm.

15 cm.

16 cm.

17 cm.

18 cm.

19 cm.

20 cm.

El precio debe calcularse automáticamente utilizando la combinación exacta de:

Modalidad.

Tamaño.

El precio debe permanecer bloqueado para los colaboradores.

El administrador podrá modificar excepcionalmente el precio de una línea del pedido, pero deberá indicar un motivo.

Motivos posibles:

Descuento autorizado.

Precio especial.

Reposición.

Promoción.

Ajuste manual.

Registrar cualquier modificación manual en el historial.

CAMBIO DE TAMAÑO O MODALIDAD

Si se cambia el tamaño o modalidad antes de finalizar el pedido:

Recalcular precio unitario.

Recalcular subtotal.

Recalcular total.

Recalcular saldo pendiente.

Mostrar el cambio al usuario.

Si ya existen pagos registrados:

Mostrar advertencia.

Actualizar saldo.

Registrar el cambio en el historial.

MISMO DISEÑO EN DISTINTOS TAMAÑOS

Permitir agregar el mismo diseño varias veces con diferentes tamaños o modalidades.

Ejemplo:

Muñeco de nieve, solo cortador, 7 cm.

Muñeco de nieve, solo cortador, 10 cm.

Muñeco de nieve, con sello, 8 cm.

Cada combinación debe ser una línea independiente con:

Precio.

Cantidad.

Check.

Avance.

Notas.

Imágenes personalizadas.

IMÁGENES PERSONALIZADAS POR ARTÍCULO

Cada artículo del pedido debe permitir cargar una o varias imágenes específicas.

Pueden ser:

Diseños personalizados.

Imágenes enviadas por el cliente.

Logotipos.

Personajes.

Nombres.

Textos.

Medidas.

Bocetos.

Fotografías.

Capturas de conversación.

Ejemplos de acabado.

No reemplazar las imágenes generales del catálogo.

Conservar separadas:

Imágenes del catálogo.

Imágenes específicas del pedido.

Si existen imágenes específicas del pedido, mostrarlas primero.

Si no existen, mostrar la imagen principal del catálogo.

Las imágenes del pedido deben conservarse aunque posteriormente cambie el catálogo.

NOTAS ADICIONALES CON IMÁGENES

Crear una sección llamada:

“Notas adicionales”.

Permitir dos tipos de notas:

Notas generales del pedido.

Notas específicas de cada artículo.

Cada nota puede contener:

Título opcional.

Texto.

Usuario.

Fecha.

Hora.

Indicador de nota importante.

Una o varias imágenes.

Archivos adjuntos.

Diferenciar visualmente las notas generales y las notas de artículos.

INFORMACIÓN GENERAL DEL PEDIDO

Cada pedido debe tener:

ID.

Folio automático.

Fecha de registro.

Fecha compromiso.

Cliente.

Tipo de entrega.

Prioridad.

Responsable.

Estado del pedido.

Estado del pago.

Productos.

Imágenes.

Notas.

Subtotal.

Descuento.

Costo de envío.

Total.

Cantidad pagada.

Saldo pendiente.

Usuario creador.

Fecha de última modificación.

Formato de folio:

CM-AÑO-NÚMERO

Ejemplo:

CM-2026-0001

Prioridades:

Baja.

Normal.

Alta.

Urgente.

PAGOS Y ABONOS

Permitir registrar uno o varios pagos.

Cada pago debe tener:

Cantidad.

Fecha.

Método.

Referencia.

Notas.

Imagen opcional del comprobante.

Usuario que lo registró.

Métodos:

Transferencia.

Efectivo.

Tarjeta.

Depósito.

Otro.

Calcular automáticamente:

Total = subtotal de productos - descuento + costo de envío.

Saldo pendiente = total - suma de pagos.

Estados de pago:

Sin pago.

Pago parcial.

Pagado.

Reembolso.

Cancelado.

Cuando el saldo sea cero, cambiar automáticamente a:

“Pagado”.

ESTADOS DE PEDIDOS

Utilizar:

En espera.

En preparación.

Enviado.

Finalizado.

Pausado.

Cancelado.

Crear una vista Kanban con columnas:

En espera.

En preparación.

Enviado.

Finalizado.

Permitir mover pedidos entre columnas mediante arrastrar y soltar.

Mostrar Pausados y Cancelados mediante filtros o vistas separadas.

Crear también una vista de tabla.

TARJETAS DE PEDIDOS

Cada tarjeta debe mostrar:

Folio.

Cliente.

Fecha compromiso.

Responsable.

Prioridad.

Tipo de entrega.

Total.

Saldo pendiente.

Estado del pago.

Cantidad de artículos.

Artículos terminados.

Artículos pendientes.

Porcentaje de producción.

CONTROL DE PRODUCCIÓN POR ARTÍCULO

En el detalle del pedido, mostrar una lista clara de todos los artículos.

Cada artículo debe mostrar:

Miniatura.

Nombre.

Categoría.

Modalidad cuando sea cortador.

Tamaño cuando sea cortador.

Cantidad.

Precio unitario.

Subtotal.

Notas.

Indicaciones.

Cantidad terminada.

Check de terminado.

Botón rápido para ver imágenes.

Cada artículo debe tener un check para marcarlo como listo.

Al marcarlo, guardar:

Estado terminado.

Fecha.

Hora.

Usuario.

Al desmarcarlo, registrar también la acción.

Si la cantidad es mayor a uno, permitir:

Marcar toda la línea como terminada.

Registrar cantidad terminada.

Ejemplo:

3 de 5 terminados.

Mostrar automáticamente:

Artículos terminados.

Artículos pendientes.

Porcentaje.

Barra de progreso.

Cuando todos los artículos estén listos, mostrar:

“Todos los productos de este pedido están listos”.

Sugerir cambiar el pedido a Enviado o Finalizado según el tipo de entrega.

BOTÓN RÁPIDO PARA VER IMÁGENES

Junto al check de cada artículo, colocar un botón con ícono de imagen u ojo.

Al presionarlo, abrir un modal sin salir del pedido.

Mostrar las imágenes en este orden:

Imágenes personalizadas del artículo en ese pedido.

Imágenes del producto en el catálogo.

Imágenes de las notas específicas del artículo.

Identificar cada imagen como:

Imagen personalizada del pedido.

Imagen del catálogo.

Imagen de una nota.

Permitir:

Ampliar.

Pasar entre imágenes.

Ver en tamaño completo.

Descargar para consulta interna.

Si no existen imágenes personalizadas, mostrar la imagen principal del catálogo.

Si no existe ninguna imagen, desactivar el botón o mostrar:

“Sin imágenes”.

VISTA DETALLADA DEL PEDIDO

Mostrar:

Folio.

Cliente.

Botón de WhatsApp.

Fecha compromiso.

Responsable.

Prioridad.

Estado.

Avance.

Productos.

Checks.

Botones de imágenes.

Notas generales.

Notas por artículo.

Galerías.

Pagos.

Saldo pendiente.

Dirección.

Lugar de entrega.

Número de guía.

Historial.

Acciones:

Editar.

Duplicar.

Imprimir.

Registrar pago.

Añadir nota.

Subir imágenes.

Cambiar responsable.

Cambiar estado.

Pausar.

Cancelar.

Finalizar.

Antes de marcar como Enviado, mostrar advertencia si no existe número de guía.

Antes de finalizar, mostrar advertencia si existe saldo pendiente, pero permitir continuar con confirmación.

CLIENTES

Cada cliente debe tener:

Nombre.

Apellidos.

Teléfono.

Medio de contacto.

Direcciones.

Número de pedidos.

Total comprado.

Saldo pendiente.

Último pedido.

Historial.

Notas.

Incluir botón para abrir WhatsApp.

PANEL GENERAL

Mostrar tarjetas con:

Pedidos en espera.

Pedidos en preparación.

Pedidos enviados.

Pedidos finalizados.

Pedidos atrasados.

Pedidos que vencen hoy.

Pedidos con saldo pendiente.

Artículos pendientes.

Pedidos completamente producidos.

Total vendido.

Total cobrado.

Total pendiente por cobrar.

Incluir:

Próximas entregas.

Pedidos urgentes.

Actividad reciente.

Ventas por categoría.

Pedidos por estado.

Avance de producción.

BÚSQUEDA Y FILTROS

Permitir buscar por:

Folio.

Nombre.

Apellidos.

Teléfono.

Producto.

SKU.

Categoría.

Número de guía.

Texto de notas.

Filtros:

Estado del pedido.

Estado del pago.

Categoría.

Responsable.

Tipo de entrega.

Prioridad.

Rango de fechas.

Pedidos atrasados.

Pedidos con artículos pendientes.

Pedidos completamente producidos.

Pedidos con imágenes personalizadas.

HISTORIAL DE ACTIVIDAD

Registrar:

Creación de pedidos.

Ediciones.

Cambios de estado.

Cambios de precio.

Cambios de tamaño.

Cambios de modalidad.

Pagos.

Cambios de domicilio.

Imágenes cargadas.

Imágenes eliminadas.

Notas añadidas.

Artículos marcados como listos.

Artículos desmarcados.

Importaciones.

Cancelaciones.

Finalizaciones.

Cada registro debe guardar:

Usuario.

Acción.

Fecha.

Hora.

Pedido relacionado.

Producto relacionado.

Valor anterior.

Valor nuevo.

BASE DE DATOS

Crear las siguientes tablas o entidades:

profiles.

customers.

customer_addresses.

products.

product_images.

cutter_price_rules.

orders.

order_items.

order_item_images.

order_notes.

note_attachments.

payments.

payment_attachments.

shipping_details.

personal_delivery_details.

product_imports.

product_import_rows.

activity_log.

CAMPOS DE CUTTER_PRICE_RULES

id.

modality.

size_cm.

price.

active.

created_at.

updated_at.

updated_by.

Valores permitidos para modality:

cutter_only.

cutter_with_stamp.

CAMPOS IMPORTANTES DE PRODUCTS

id.

sku.

name.

category.

base_price.

description.

manufacturing_notes.

active.

created_at.

updated_at.

created_by.

Reglas:

Para CORTADORES, base_price debe ser nulo.

Para STENCILS, CAJAS y OTROS, base_price debe ser obligatorio.

CAMPOS IMPORTANTES DE ORDER_ITEMS

Guardar una copia histórica de:

Producto original.

SKU.

Nombre del producto.

Categoría.

Descripción.

Notas.

Cantidad.

Precio unitario aplicado.

Subtotal.

Modalidad del cortador.

Tamaño del cortador.

Cantidad terminada.

Estado terminado.

Fecha de terminación.

Usuario que terminó el artículo.

Indicador de precio modificado.

Motivo del cambio manual.

Fecha en que se aplicó el precio.

Los pedidos anteriores no deben cambiar cuando se modifique el catálogo o la tabla de precios.

CAMPOS DE PRODUCT_IMPORTS

Guardar:

Usuario.

Archivo.

Fecha.

Hora.

Estado.

Total de filas.

Productos creados.

Productos actualizados.

Productos omitidos.

Errores.

CAMPOS DE PRODUCT_IMPORT_ROWS

Guardar:

Importación relacionada.

Número de fila.

Datos originales.

Estado.

Mensaje de error.

Producto creado o actualizado.

ALMACENAMIENTO DE ARCHIVOS

Utilizar Supabase Storage privado.

Organizar los archivos en carpetas o rutas para:

Imágenes del catálogo.

Imágenes personalizadas de pedidos.

Imágenes de notas.

Comprobantes.

Guías de envío.

Archivos de importación.

Archivos ZIP.

Reportes de errores.

SEGURIDAD

Aplicar Row Level Security.

Ningún usuario externo debe poder consultar:

Clientes.

Teléfonos.

Direcciones.

Pedidos.

Imágenes.

Pagos.

Notas.

Comprobantes.

Historial.

Todos los usuarios autorizados deben poder consultar la información necesaria según su rol.

VALIDACIONES OBLIGATORIAS

No permitir guardar un cortador dentro de un pedido si falta:

Producto.

Modalidad.

Tamaño.

Cantidad.

No permitir registrar STENCILS, CAJAS u OTROS sin precio.

No pedir precio al registrar un CORTADOR.

No calcular el precio según el nombre del producto.

Calcularlo únicamente según:

Modalidad.

Tamaño.

No permitir que un colaborador modifique la tabla general de precios.

No sobrescribir los precios históricos de pedidos anteriores.

No eliminar productos relacionados con pedidos.

No crear duplicados silenciosamente durante una importación.

No perder imágenes sin mostrar una advertencia.

EXPERIENCIA DE USO

Priorizar:

Rapidez.

Claridad.

Pocos pasos.

Guardado automático.

Diseño responsivo.

Miniaturas visibles.

Consulta rápida de imágenes.

Checks grandes.

Formularios fáciles.

Mensajes claros.

Confirmaciones antes de acciones importantes.

Sincronización entre dispositivos.

Navegación sencilla.

Buena experiencia desde celular.

Crear algunos datos de demostración para probar las funciones.

Dentro de Configuración, agregar una opción para eliminar todos los datos de demostración.

Construir primero una versión funcional con:

Autenticación.

Usuarios.

Clientes.

Catálogo.

Imágenes.

Importación masiva.

Captura rápida.

Tabla automática de precios de cortadores.

Pedidos.

Artículos.

Notas.

Checks.

Avance de producción.

Pagos.

Estados.

Historial.

Supabase Storage.

Row Level Security.

No dejar botones sin funcionamiento ni utilizar solamente información simulada. Todas las funciones principales deben guardar y consultar datos reales desde Supabase. o la nube de lovable lo que sea mas facil de usar y hacer para ti

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://moon-order-pro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0fca80f6-2a12-4a44-a5d7-89be8ca0bb61).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
