/*global define*/
define([
        './defaultValue',
        './DeveloperError',
        './Math',
        './Cartesian3',
        './Visibility',
        './Ellipsoid',
        './BoundingSphere'
    ], function(
        defaultValue,
        DeveloperError,
        CesiumMath,
        Cartesian3,
        Visibility,
        Ellipsoid,
        BoundingSphere) {
    "use strict";

    /**
     * Determine whether or not other objects are visible or hidden behind the visible horizon defined by
     * an {@link Ellipsoid} and a camera position.  The ellipsoid is assumed to be located at the
     * origin of the coordinate system.  This class uses the algorithm described in the
     * <a href="http://cesium.agi.com/2013/04/25/Horizon-culling/">Horizon Culling</a> blog post.
     *
     * @alias EllipsoidalOccluder
     *
     * @param {Ellipsoid} ellipsoid The ellipsoid to use as an occluder.
     * @param {Cartesian3} [cameraPosition] The coordinate of the viewer/camera.  If this parameter is not
     *        specified, {@link EllipsoidalOccluder#setCameraPosition} must be called before
     *        testing visibility.
     *
     * @exception {DeveloperError} <code>ellipsoid</code> is required.
     *
     * @constructor
     *
     * @example
     * // Construct an ellipsoidal occluder with radii 1.0, 1.1, and 0.9.
     * var cameraPosition = new Cartesian3(5.0, 6.0, 7.0);
     * var occluderEllipsoid = new Ellipsoid(1.0, 1.1, 0.9);
     * var occluder = new EllipsoidalOccluder(occluderEllipsoid, cameraPosition);
     */
    var EllipsoidalOccluder = function(ellipsoid, cameraPosition) {
        if (typeof ellipsoid === 'undefined') {
            throw new DeveloperError('ellipsoid is required.');
        }

        this._ellipsoid = ellipsoid;
        this._cameraPosition = new Cartesian3();
        this._cameraPositionInScaledSpace = new Cartesian3();
        this._distanceToLimbInScaledSpaceSquared = 0.0;

        // setCameraPosition fills in the above values
        if (typeof cameraPosition !== 'undefined') {
            this.setCameraPosition(cameraPosition);
        }
    };

    /**
     * Returns the occluding ellipsoid.
     *
     * @memberof EllipsoidalOccluder
     *
     * @return {Ellipsoid} The ellipsoid.
     */
    EllipsoidalOccluder.prototype.getEllipsoid = function() {
        return this._ellipsoid;
    };

    /**
     * Sets the position of the camera.
     *
     * @memberof EllipsoidalOccluder
     *
     * @param {Cartesian3} cameraPosition The new position of the camera.
     */
    EllipsoidalOccluder.prototype.setCameraPosition = function(cameraPosition) {
        // See http://cesium.agi.com/2013/04/25/Horizon-culling/
        var ellipsoid = this._ellipsoid;
        var cv = ellipsoid.transformPositionToScaledSpace(cameraPosition, this._cameraPositionInScaledSpace);
        var vhMagnitudeSquared = Cartesian3.magnitudeSquared(cv) - 1.0;

        Cartesian3.clone(cameraPosition, this._cameraPosition);
        this._cameraPositionInScaledSpace = cv;
        this._distanceToLimbInScaledSpaceSquared = vhMagnitudeSquared;
    };

    /**
     * Gets the position of the camera.
     *
     * @memberof EllipsoidalOccluder
     *
     * @returns {Cartesian3} The position of the camera.
     */
    EllipsoidalOccluder.prototype.getCameraPosition = function() {
        return this._cameraPosition;
    };

    var scratchCartesian = new Cartesian3();

    /**
     * Determines whether or not a point, the <code>occludee</code>, is hidden from view by the occluder.
     *
     * @memberof EllipsoidalOccluder
     *
     * @param {Cartesian3} occludee The point to test for visibility.
     *
     * @return {boolean} <code>true</code> if the occludee is visible; otherwise <code>false</code>.
     *
     * @example
     * var cameraPosition = new Cartesian3(0, 0, 2.5);
     * var ellipsoid = new Ellipsoid(1.0, 1.1, 0.9);
     * var occluder = new EllipsoidalOccluder(ellipsoid, cameraPosition);
     * var point = new Cartesian3(0, -3, -3);
     * occluder.isPointVisible(point); //returns true
     */
    EllipsoidalOccluder.prototype.isPointVisible = function(occludee) {
        var ellipsoid = this._ellipsoid;
        var occludeeScaledSpacePosition = ellipsoid.transformPositionToScaledSpace(occludee, scratchCartesian);
        return this.isScaledSpacePointVisible(occludeeScaledSpacePosition);
    };

    /**
     * Determines whether or not a point expressed in the ellipsoid scaled space, is hidden from view by the
     * occluder.  To transform a Cartesian X, Y, Z position in the coordinate system aligned with the ellipsoid
     * into the scaled space, call {@link Ellipsoid#transformPositionToScaledSpace}.
     *
     * @memberof EllipsoidalOccluder
     *
     * @param {Cartesian3} occludeeScaledSpacePosition The point to test for visibility, represented in the scaled space.
     *
     * @return {boolean} <code>true</code> if the occludee is visible; otherwise <code>false</code>.
     *
     * @example
     * var cameraPosition = new Cartesian3(0, 0, 2.5);
     * var ellipsoid = new Ellipsoid(1.0, 1.1, 0.9);
     * var occluder = new EllipsoidalOccluder(ellipsoid, cameraPosition);
     * var point = new Cartesian3(0, -3, -3);
     * var scaledSpacePoint = ellipsoid.transformPositionToScaledSpace(point);
     * occluder.isScaledSpacePointVisible(scaledSpacePoint); //returns true
     */
    EllipsoidalOccluder.prototype.isScaledSpacePointVisible = function(occludeeScaledSpacePosition) {
        // See http://cesium.agi.com/2013/04/25/Horizon-culling/
        var cv = this._cameraPositionInScaledSpace;
        var vhMagnitudeSquared = this._distanceToLimbInScaledSpaceSquared;
        var vt = Cartesian3.subtract(occludeeScaledSpacePosition, cv, scratchCartesian);
        var vtDotVc = -vt.dot(cv);
        var isOccluded = vtDotVc > vhMagnitudeSquared &&
                         vtDotVc * vtDotVc / vt.magnitudeSquared() > vhMagnitudeSquared;
        return !isOccluded;
    };

    var scaledSpaceScratch = new Cartesian3();
    var directionToPointScratch = new Cartesian3();
    var directionScratch = new Cartesian3();

    /**
     * Computes a point that can be used for horizon culling from a list of positions.  If the point is below
     * the horizon, all of the positions are guaranteed to be below the horizon as well.  The returned point
     * is expressed in the ellipsoid-scaled space and is suitable for use with
     * {@link EllipsoidalOccluder#isScaledSpacePointVisible}.
     *
     * @param {Cartesian3} directionToPoint The direction that the computed point will lie along.
     *                     A reasonable direction to use is the direction from the center of the ellipsoid to
     *                     the center of the bounding sphere computed from the positions.  The direction need not
     *                     be normalized.
     * @param {Cartesian3[]} positions The positions from which to compute the horizon culling point.  The positions
     *                       must be expressed in a reference frame centered at the ellipsoid and aligned with the
     *                       ellipsoid's axes.
     * @param {Cartesian3} [result] The instance on which to store the result instead of allocating a new instance.
     * @returns {Cartesian3} The computed horizon culling point, expressed in the ellipsoid-scaled space.
     */
    EllipsoidalOccluder.prototype.computeHorizonCullingPoint = function(directionToPoint, positions, result) {
        if (typeof directionToPoint === 'undefined') {
            throw new DeveloperError('directionToPoint is required');
        }
        if (typeof positions === 'undefined') {
            throw new DeveloperError('directionToPoint is required');
        }

        var ellipsoid = this._ellipsoid;

        ellipsoid.transformPositionToScaledSpace(directionToPoint, directionToPointScratch);
        var scaledSpaceDirectionToPoint = directionToPointScratch.normalize(directionToPointScratch);

        var resultMagnitude = 0.0;

        for (var i = 0, len = positions.length; i < len; ++i) {
            var position = positions[i];
            var scaledSpacePosition = ellipsoid.transformPositionToScaledSpace(position, scaledSpaceScratch);
            var magnitudeSquared = scaledSpacePosition.magnitudeSquared();
            var magnitude = Math.sqrt(magnitudeSquared);
            var direction = scaledSpacePosition.divideByScalar(magnitude, directionScratch);

            var cosAlpha = direction.dot(scaledSpaceDirectionToPoint);
            var sinAlpha = direction.cross(scaledSpaceDirectionToPoint).magnitude();
            var cosBeta = 1.0 / magnitude;
            var sinBeta = Math.sqrt(magnitudeSquared - 1.0) * cosBeta;

            var candidateMagnitude = 1.0 / (cosAlpha * cosBeta - sinAlpha * sinBeta);
            resultMagnitude = Math.max(resultMagnitude, candidateMagnitude);
        }

        return scaledSpaceDirectionToPoint.multiplyByScalar(resultMagnitude, result);
    };

    return EllipsoidalOccluder;
});