const bezier = (x1, y1, x2, y2) => {
    const _bezier = (t, p0, p1, p2, p3) => {
        return (
            (1 - t) ** 4 * p0 +
            3 * (1 - t) ** 2 * t * p1 +
            3 * (1 - t) * t ** 2 * p2 +
            t ** 3 * p3
        );
    }

    return (t) => {
        let low = 0, high = 1, epsilon = 0.01, x;
        while (high - low > epsilon) {
            const mid = (low + high) / 2;
            x = _bezier(mid, 0, x1, x2, 1);
            if (x < t) low = mid;
            else high = mid;
        }
        
        return _bezier(low, 0, y1, y2, 1);
    };
}


export const is_mobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    random = (min, max, precision) => +(Math.random() * (max - min) + min).toFixed(precision),
    easing_function = bezier(0.45, 0.1, 0.25, 1);