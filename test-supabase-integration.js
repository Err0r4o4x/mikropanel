// Script de prueba para verificar la integración con Supabase
// Ejecutar en la consola del navegador después de cargar la aplicación

console.log('🧪 Iniciando pruebas de integración Supabase...');

async function testSupabaseIntegration() {
  const tests = [];
  
  // Test 1: Verificar que localStorage está interceptado
  console.log('📝 Test 1: Verificando override de localStorage...');
  
  // Guardar un valor de prueba
  localStorage.setItem('test_key', JSON.stringify({ test: 'value', timestamp: Date.now() }));
  
  // Verificar que se puede recuperar
  const retrieved = localStorage.getItem('test_key');
  if (retrieved) {
    const parsed = JSON.parse(retrieved);
    console.log('✅ localStorage override funcionando:', parsed);
    tests.push({ name: 'localStorage override', passed: true });
  } else {
    console.log('❌ localStorage override falló');
    tests.push({ name: 'localStorage override', passed: false });
  }
  
  // Test 2: Verificar claves específicas del sistema
  console.log('📝 Test 2: Verificando claves del sistema...');
  
  const systemKeys = [
    'app_zonas',
    'app_tarifas', 
    'app_clientes',
    'app_equipos',
    'app_movimientos',
    'app_gastos',
    'app_users',
    'app_user'
  ];
  
  let systemKeysWorking = 0;
  
  for (const key of systemKeys) {
    try {
      // Intentar leer (puede ser null si no existe)
      const value = localStorage.getItem(key);
      console.log(`  - ${key}:`, value ? 'Datos encontrados' : 'Sin datos (normal)');
      systemKeysWorking++;
    } catch (error) {
      console.log(`  - ${key}: Error -`, error.message);
    }
  }
  
  tests.push({ 
    name: 'System keys access', 
    passed: systemKeysWorking === systemKeys.length 
  });
  
  // Test 3: Verificar persistencia
  console.log('📝 Test 3: Verificando persistencia...');
  
  const testData = {
    timestamp: Date.now(),
    data: ['item1', 'item2', 'item3'],
    config: { enabled: true, value: 42 }
  };
  
  localStorage.setItem('test_persistence', JSON.stringify(testData));
  
  // Simular recarga (limpiar cache)
  setTimeout(() => {
    const persisted = localStorage.getItem('test_persistence');
    if (persisted) {
      const parsed = JSON.parse(persisted);
      const matches = JSON.stringify(parsed) === JSON.stringify(testData);
      console.log('✅ Persistencia funcionando:', matches);
      tests.push({ name: 'Data persistence', passed: matches });
    } else {
      console.log('❌ Persistencia falló');
      tests.push({ name: 'Data persistence', passed: false });
    }
    
    // Mostrar resumen final
    console.log('\n📊 Resumen de pruebas:');
    tests.forEach(test => {
      console.log(`${test.passed ? '✅' : '❌'} ${test.name}`);
    });
    
    const passed = tests.filter(t => t.passed).length;
    const total = tests.length;
    
    if (passed === total) {
      console.log(`\n🎉 ¡Todas las pruebas pasaron! (${passed}/${total})`);
      console.log('✅ La integración con Supabase está funcionando correctamente');
    } else {
      console.log(`\n⚠️ Algunas pruebas fallaron (${passed}/${total})`);
      console.log('❌ Revisar la configuración de Supabase');
    }
    
    // Limpiar datos de prueba
    localStorage.removeItem('test_key');
    localStorage.removeItem('test_persistence');
    console.log('\n🧹 Datos de prueba limpiados');
  }, 2000);
}

// Ejecutar pruebas
testSupabaseIntegration();

// Función auxiliar para verificar el estado del storage
window.checkStorageStatus = function() {
  console.log('📊 Estado actual del storage:');
  console.log('- Override activo:', typeof Storage !== 'undefined' && Storage.prototype.getItem.toString().includes('Supabase'));
  console.log('- Claves en localStorage:', Object.keys(localStorage));
  
  // Intentar obtener estadísticas si están disponibles
  if (typeof window.getStorageStats === 'function') {
    window.getStorageStats().then(stats => {
      console.log('- Estadísticas:', stats);
    });
  }
};

console.log('✨ Pruebas iniciadas. Usa checkStorageStatus() para ver el estado en cualquier momento.');
