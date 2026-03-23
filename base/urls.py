from django.urls import path
from . import views

urlpatterns = [
    path('api/chat', views.chat_api, name='chat_api'),
    path('api/health', views.health_check, name='health_check'),
]
