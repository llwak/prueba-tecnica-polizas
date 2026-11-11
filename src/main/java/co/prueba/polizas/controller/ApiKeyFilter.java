package co.prueba.polizas.controller;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class ApiKeyFilter extends OncePerRequestFilter {
    private static final Set<String> DEMO_FILES = Set.of(
            "/demo/index.html", "/demo/app.css", "/demo/app.js", "/demo/logo.png");

    private final byte[] expectedKey;

    public ApiKeyFilter(@Value("${app.api-key}") String expectedKey) {
        this.expectedKey = expectedKey.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return ("GET".equals(request.getMethod()) || "HEAD".equals(request.getMethod()))
                && DEMO_FILES.contains(path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String suppliedKey = request.getHeader("x-api-key");
        if (suppliedKey == null || !MessageDigest.isEqual(expectedKey,
                suppliedKey.getBytes(StandardCharsets.UTF_8))) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write("""
                    {"title":"No autorizado","status":401,"detail":"La clave de API es obligatoria y debe ser válida."}
                    """);
            return;
        }
        chain.doFilter(request, response);
    }
}
