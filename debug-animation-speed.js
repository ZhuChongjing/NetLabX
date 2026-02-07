// 动画速度控制调试脚本
// 在浏览器控制台中运行此脚本来诊断问题

console.log('🔍 开始诊断动画速度控制...\n');

// 1. 检查 store 是否可访问
let store;
try {
  store = window.__ZUSTAND_STORE__ || useNetworkStore?.getState?.();
  if (!store) {
    console.error('❌ 无法访问 store，请确保已加载应用');
  } else {
    console.log('✅ store 访问成功');
  }
} catch (e) {
  console.error('❌ store 访问失败:', e.message);
}

// 2. 检查 gradingTools 配置
if (store) {
  console.log('\n📊 当前 gradingTools 配置:');
  console.log('  animationMode:', store.gradingTools?.animationMode);
  console.log('  fastMode:', store.gradingTools?.fastMode);

  if (!store.gradingTools) {
    console.error('❌ gradingTools 未初始化');
  } else if (!store.gradingTools.animationMode) {
    console.warn('⚠️ animationMode 未设置，当前值:', store.gradingTools.animationMode);
    console.log('   回退逻辑会使用:', store.gradingTools.fastMode ? 'fast' : 'normal');
  } else {
    console.log('✅ animationMode 已设置');
  }
}

// 3. 检查 setAnimationMode 函数是否存在
if (store) {
  console.log('\n🔧 检查 setAnimationMode 函数:');
  if (typeof store.setAnimationMode === 'function') {
    console.log('✅ setAnimationMode 函数存在');

    // 测试函数调用
    console.log('\n🧪 测试速度切换:');
    const originalMode = store.gradingTools?.animationMode;
    console.log('  原始速度:', originalMode);

    try {
      store.setAnimationMode('fast');
      setTimeout(() => {
        const newMode = useNetworkStore.getState().gradingTools?.animationMode;
        console.log('  切换后速度:', newMode);
        if (newMode === 'fast') {
          console.log('  ✅ 速度切换成功');
          // 恢复原始设置
          store.setAnimationMode(originalMode || 'normal');
        } else {
          console.error('  ❌ 速度切换失败，仍然是:', newMode);
        }
      }, 100);
    } catch (e) {
      console.error('  ❌ 调用 setAnimationMode 出错:', e.message);
    }
  } else {
    console.error('❌ setAnimationMode 函数不存在');
    console.log('   可用的函数:', Object.keys(store).filter(k => typeof store[k] === 'function'));
  }
}

// 4. 检查 applySpeed 函数
console.log('\n⚙️ 检查 applySpeed 函数逻辑:');
console.log('  测试 applySpeed(500, "slow")  应该 ≈ 750ms');
console.log('  测试 applySpeed(500, "normal") 应该 = 500ms');
console.log('  测试 applySpeed(500, "fast")   应该 ≈ 125ms');
console.log('  测试 applySpeed(500, "skip")   应该 = 0ms');

// 5. 监听速度变化
console.log('\n👂 设置速度变化监听...');
if (store && typeof store.subscribe === 'function') {
  const unsubscribe = store.subscribe((state, prevState) => {
    if (state.gradingTools?.animationMode !== prevState.gradingTools?.animationMode) {
      console.log('🎬 动画速度已变更:',
        prevState.gradingTools?.animationMode, '→', state.gradingTools?.animationMode);
    }
  });
  console.log('✅ 监听已设置（切换速度时会在控制台显示）');
  console.log('   执行 unsubscribe() 可取消监听');
  window.unsubscribeAnimationSpeed = unsubscribe;
} else {
  console.warn('⚠️ 无法设置监听器');
}

console.log('\n📝 诊断完成！\n');
console.log('🔍 下一步：');
console.log('  1. 在界面上切换动画速度');
console.log('  2. 观察控制台是否输出"动画速度已变更"');
console.log('  3. 执行一次 Tracert/DNS/HTTP 测试');
console.log('  4. 观察动画是否有明显速度变化\n');
