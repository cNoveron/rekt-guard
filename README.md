# Rekt Guard

## Problema

Los auditores de contratos inteligentes enfrentan el problema de que las diferentes herramientas que son necesarias en diferentes etapas de la auditoría de contratos inteligentes presentan una rigidez notoria cuando se presentan necesidades como personalizar el formato en que se visualizan ciertos tipos de datos, como lo son los nombres de funciones, sus firmas y sus selectores, lo mismo sucede con estos datos cuando están codificados y se necesitan decodificar. Por ejemplo, Foundry provee varias herramientas que permiten extraer y decodificar los parámetros de las llamadas a funciones de los contratos inteligentes, pero no permiten formatear dichos parámetros para poder visualizarlos y decodificarlos por separado. No permite cambiar fácilmente entre las cadenas de texto hexadecimal codificadas y las decodificadas. Tampoco permite la identificación de los nombres de los contratos vía Etherscan. Ahí surge la necesidad de utilizar varias herramientas que se encuentran por separado y no están diseñadas para ser fácilmente integradas.

## Solución

Rekt Guard es una herramienta que facilita los pasos primordiales en la auditoria de smart contracts.

1) Como primer paso, Rekt Guard hace uso de la API de Tenderly para obtener el rastro de llamadas (call trace) de una transacción en blockchains compatibles con la EVM.

2) Una vez obtenido el call trace la aplicación hace uso de la API de Etherscan para obtener los nombres y código fuente de los contratos inteligentes estos se encuentran verificados en su plataforma.

3) Realiza una consulta a nuestro servicio back end donde se analilza el rastro de llamadas para obtener las firmas de los métodos (funciones) y los parámetros de llamada decodificados.

4) Una vez obtenidas las firmas el front-end procede a producir los selectores (Los primeros 4 bytes del digesto keccak256 de las firmas), con ellos es posible adjudicar las firmas y los parámetros decodificados para substituirlos en nuestro árbol de llamadas y así ser analizados.

5) Ya que el árbol de llamadas se vuelve más claro, el auditor podrá proceder a identificar las llamadas que implican las interacciones más críticas en cuanto a severidad de potenciales vulnerabilidades.

6) Cuando identificamos los contratos críticos podemos hacer click en sus respectivas direcciones en la tabla para que a través de un pop-up tengamos la opción de obtener analizar dichos contratos con la API de DD Analyzer de Webacy.

El auditor ahora será capáz de producir con facilidad un reporte de riesgos de los contratos críticos involucrados en la transacción.

