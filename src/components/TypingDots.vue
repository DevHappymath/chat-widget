<!-- Ba chấm nhảy báo có người đang soạn tin; màu theo chữ của khung bao ngoài. -->
<template>
  <span class="inline-flex items-center gap-1" aria-hidden="true">
    <span class="typing-dot size-1.5 rounded-full bg-current" />
    <span class="typing-dot size-1.5 rounded-full bg-current" />
    <span class="typing-dot size-1.5 rounded-full bg-current" />
  </span>
</template>

<style scoped>
.typing-dot {
  animation: typing-bounce 1.2s ease-in-out infinite;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typing-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.5;
  }

  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

@keyframes typing-fade {
  0%,
  100% {
    opacity: 0.4;
  }

  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .typing-dot {
    animation-name: typing-fade;
  }
}
</style>
